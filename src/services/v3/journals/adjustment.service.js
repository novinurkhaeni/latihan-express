require('module-alias/register');
const { response } = require('@helpers');
const {
  sequelize,
  journals: Journal,
  employee_notes: EmployeeNote,
  users: User,
  employees: Employee
} = require('@models');
const { dateConverter, formatCurrency } = require('@helpers');

const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const adjustmentService = {
  addAdjustment: async (req, res) => {
    const { data } = req.body;
    const { type } = req.query;
    const { id, employeeId } = res.local.users;
    const employeeIds = data.employee_ids.split(',');
    const dateNow = dateConverter(new Date());
    const transaction = await sequelize.transaction();
    try {
      // Compose All Payload
      const journalPayload = [];
      const notePayload = [];
      employeeIds.forEach(employee_id => {
        // Journal Payload
        journalPayload.push({
          employee_id,
          type: 'other',
          debet: type === 'bonus' ? data.amount : 0,
          kredit: type === 'penalty' ? data.amount : 0,
          description: `${type === 'bonus' ? 'Bonus' : 'Potongan'} manual tanggal ${dateNow}`
        });
        // Note Payload
        notePayload.push({
          employee_id,
          type: type === 'bonus' ? 1 : 2,
          date: dateNow,
          notes: data.note,
          amount: data.amount
        });
      });
      // Insert Journal
      const users = await Employee.findAll({
        attributes: ['id'],
        where: { id: employeeIds },
        include: { model: User, attributes: ['full_name'] }
      });
      const userNames = users
        .map(val => val.user.full_name)
        .toString()
        .replace(',', ', ');
      const insertJournal = await Journal.bulkCreate(journalPayload, { transaction });
      if (!insertJournal) {
        await transaction.rollback();
        return res
          .status(400)
          .json(response(false, `Gagal membuat ${type === 'bonus' ? 'bonus' : 'potongan'} manual`));
      }
      // Insert Note
      const insertNote = await EmployeeNote.bulkCreate(notePayload, { transaction });
      if (!insertNote) {
        await transaction.rollback();
        return res
          .status(400)
          .json(response(false, `Gagal membuat ${type === 'bonus' ? 'bonus' : 'potongan'} manual`));
      }
      await transaction.commit();

      // SEND NOTIFICATION TO MANAGERS
      const checkUser = await User.findOne({ where: { id } });
      const description = `${checkUser.full_name} telah membuat ${
        type === 'bonus' ? 'bonus' : 'potongan'
      } manual sebesar Rp ${formatCurrency(data.amount)} kepada ${userNames}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });

      return res
        .status(200)
        .json(response(true, `${type === 'bonus' ? 'Bonus' : 'Potongan'} manual berhasil dibuat`));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  editJournalBonusOrPenalty: async (req, res) => {
    const { data } = req.body;
    const { journal_id } = req.params;
    const { type } = req.query;

    try {
      const { amount, note } = data;

      const journal = await Journal.findOne({
        where: {
          id: journal_id,
          type: 'other'
        }
      });

      if (!journal) {
        return res.status(400).json(response(false, 'Data journal tidak di temukan'));
      }

      if (journal.debet !== 0 && type === 'bonus') {
        const updateBonus = await journal.update(
          { debet: amount, description: note },
          {
            where: {
              id: journal_id,
              type: 'other'
            },
            returning: true
          }
        );

        if (!updateBonus) {
          return res.status(400).json(response(false, 'Data bonus gagal diubah'));
        }
        return res.status(200).json(response(true, 'Data bonus berhasil diubah'));
      } else if (journal.kredit !== 0 && type === 'penalty') {
        const updatePenalty = await journal.update(
          { kredit: amount, description: note },
          {
            where: {
              id: journal_id,
              type: 'other'
            },
            returning: true
          }
        );
        if (!updatePenalty) {
          return res.status(400).json(response(false, 'Data penalty gagal diubah'));
        }

        return res.status(200).json(response(true, 'Data penalty berhasil diubah'));
      }

      return res
        .status(400)
        .json(response(false, 'Data potongan atau bonus tidak sesuai database'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  deleteJournalBonusOrPenalty: async (req, res) => {
    const { journal_id } = req.params;

    try {
      const journal = await Journal.findOne({
        where: {
          id: journal_id,
          type: 'other'
        }
      });

      if (!journal) {
        return res.status(400).json(response(false, 'Data journal tidak di temukan'));
      }

      if (journal.debet !== 0) {
        const deleteBonus = await Journal.destroy({
          where: { id: journal_id, type: 'other' }
        });

        if (!deleteBonus) {
          return res.status(400).json(response(false, 'gagal delete bonus'));
        }
        return res.status(200).json(response(true, 'berhasil delete bonus'));
      } else if (journal.kredit !== 0) {
        const deletePenalty = await Journal.destroy({
          where: { id: journal_id, type: 'other' }
        });

        if (!deletePenalty) {
          return res.status(400).json(response(false, 'gagal delete penalty'));
        }
        return res.status(200).json(response(true, 'berhasil delete penalty'));
      }

      return res
        .status(400)
        .json(response(false, 'Data potongan atau bonus tidak sesuai database'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = adjustmentService;

require('module-alias/register');
const { response } = require('@helpers');
const { periodic_pieces: PeriodicPieces, users: User, employees: Employee } = require('@models');
const { dateConverter, formatCurrency } = require('@helpers');

const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const periodicPiecesService = {
  addPeriodicPieces: async (req, res) => {
    const { data } = req.body;
    const { id, employeeId } = res.local.users;
    const start = dateConverter(new Date().setDate(data.date));
    let end = new Date(new Date().setMonth(new Date().getMonth() + data.duration));
    end = end.setDate(data.date);
    end = dateConverter(end);
    const employeeIds = data.employee_ids.split(',');
    try {
      // Componse Payload
      const payload = [];
      for (const employeeId of employeeIds) {
        payload.push({
          employee_id: employeeId,
          type: 2,
          note: data.note,
          repeat_type: 'monthly',
          start,
          end,
          amount: data.amount
        });
      }
      // Inserting
      const createPeriodicPieces = await PeriodicPieces.bulkCreate(payload);
      if (!createPeriodicPieces) {
        return res.status(400).json(response(false, 'Gagal membuat potongan berkala'));
      }

      // SEND NOTIFICATION TO MANAGERS
      const users = await Employee.findAll({
        attributes: ['id'],
        where: { id: employeeIds },
        include: { model: User, attributes: ['full_name'] }
      });
      const userNames = users
        .map(val => val.user.full_name)
        .toString()
        .replace(',', ', ');
      const checkUser = await User.findOne({ where: { id } });
      const description = `${
        checkUser.full_name
      } telah membuat potongan berkala sebesar Rp ${formatCurrency(
        data.amount
      )} kepada ${userNames}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });

      return res.status(201).json(response(true, 'Potongan berkala berhasil dibuat'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = periodicPiecesService;

require('module-alias/register');
const { Sequelize } = require('sequelize');
const { Op } = Sequelize;
const { response } = require('@helpers');
const {
  employee_notes: EmployeeNote,
  employees: Employee,
  users: User,
  journals: JournalModel,
  digital_assets: DigitalAsset
} = require('@models');

class Journal {
  constructor(req, res) {
    this.req = req;
    this.res = res;
  }

  async getJournalHistory() {
    const {
      params: { company_id },
      query: { type, startDate, endDate }
    } = this.req;
    try {
      const getJournalHistory = await EmployeeNote.findAll({
        where: { type, date: { $between: [startDate, endDate] } },
        include: {
          model: Employee,
          required: true,
          where: { company_id },
          attributes: ['id'],
          include: { model: User, attributes: ['full_name'] }
        }
      });
      return this.res
        .status(200)
        .json(response(false, 'Data riwayat berhasil didapatkan', getJournalHistory));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }

  async getPayrollList() {
    const {
      params: { company_ids },
      query: { startDate, endDate }
    } = this.req;
    const companyIds = company_ids.split(',');
    try {
      const payrollLists = await Employee.findAll({
        where: { company_id: companyIds, role: { [Op.ne]: 1 } },
        attributes: ['id', 'role'],
        include: [
          { model: User, attributes: ['full_name'] },
          {
            model: JournalModel,
            required: false,
            attributes: ['type', 'debet', 'kredit'],
            where: [
              {},
              Sequelize.where(
                Sequelize.fn('DATE_FORMAT', Sequelize.col('journals.created_at'), '%Y-%m-%d'),
                '>=',
                startDate
              ),
              Sequelize.where(
                Sequelize.fn('DATE_FORMAT', Sequelize.col('journals.created_at'), '%Y-%m-%d'),
                '<=',
                endDate
              )
            ]
          },
          {
            model: DigitalAsset,
            required: false,
            attributes: ['url', 'type'],
            where: {
              type: 'avatar'
            },
            as: 'assets'
          }
        ]
      });

      const responses = [];
      for (const data of payrollLists) {
        let bonus = 0;
        let penalty = 0;
        let salary = 0;
        for (const journal of data.journals) {
          if (journal.type === 'other') {
            bonus += journal.debet;
            penalty += journal.kredit;
          }
          if (journal.type === 'salary') {
            salary += journal.debet;
          }
        }
        responses.push({
          full_name: data.user.full_name,
          role: data.role,
          avatar: data.assets.length ? data.assets[0].url : null,
          bonus,
          penalty,
          salary,
          total: salary + bonus - penalty
        });
      }
      return this.res
        .status(200)
        .json(response(true, 'Daftar gaji berhasil didapatkan', responses));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
}

module.exports = Journal;

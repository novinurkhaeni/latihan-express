require('module-alias/register');
const { response } = require('@helpers');
const {
  journals: Journals,
  employees: Employee,
  companies: Company,
  journal_details: JournalDetail
} = require('@models');
const Sequelize = require('sequelize');
const { Op } = Sequelize;

const dashboardService = {
  getAn: async (req, res) => {
    const { dateStart, dateEnd } = req.query;
    const { id: companyId } = req.params;
    const dateNow = new Date();
    try {
      let employeeIdArray = [];
      let depositTotal = 0;
      const company = await Company.findOne({ where: { id: companyId } });
      const employees = await Employee.findAll({
        where: { company_id: companyId }
      });
      for (let i = 0; i < employees.length; i++) {
        employeeIdArray.push(employees[i].id);
      }
      // Find Total Withdraw in Current Month
      const totalWithdraw = await Journals.findAll({
        where: [
          { employee_id: employeeIdArray, type: 'withdraw' },
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('journals.created_at'), '%Y-%c'),
            `${dateNow.getFullYear()}-${dateNow.getMonth() + 1}`
          )
        ],
        include: {
          model: JournalDetail,
          where: { status: 1 }
        }
      });

      const journalData = await Journals.findOne({
        where: [
          { employee_id: employeeIdArray },
          { type: { [Op.notIn]: ['withdraw', 'subscribe', 'payment'] } },
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
            '>=',
            dateStart
          ),
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
            '<=',
            dateEnd
          )
        ],
        attributes: [[Sequelize.fn('SUM', Sequelize.literal('`debet`-`kredit`')), 'total_salary']]
      });
      const withdrawData = await JournalDetail.findAll({
        where: { status: 1 },
        include: {
          model: Journals,
          attributes: ['type', 'employee_id', 'description'],
          where: [
            { employee_id: employeeIdArray, type: 'withdraw' },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('journal.created_at'), '%Y-%m-%d'),
              '>=',
              dateStart
            ),
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('journal.created_at'), '%Y-%m-%d'),
              '<=',
              dateEnd
            )
          ]
        }
      });
      if (withdrawData.length) {
        for (let i = 0; i < withdrawData.length; i++) {
          depositTotal += withdrawData[i].total;
        }
      }
      const payload = Object.assign(
        {},
        {
          id: companyId,
          codename: company.codename,
          company_active: company.active,
          total_salary: journalData.dataValues.total_salary - depositTotal,
          withdraw_candidate: depositTotal.toString(),
          totalWithdraw: totalWithdraw.length
        }
      );
      return res
        .status(200)
        .json(response(true, 'Deposit summary has been successfully retrieved', payload));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  get: async (req, res) => {
    const { month: month } = req.query;
    const { year: year } = req.query;
    const { id: companyId } = req.params;

    try {
      let employeeIdArray = [];
      let depositTotal = 0;
      const company = await Company.findOne({ where: { id: companyId } });
      const employees = await Employee.findAll({
        where: { company_id: companyId }
      });
      for (let i = 0; i < employees.length; i++) {
        employeeIdArray.push(employees[i].id);
      }
      const journalData = await Journals.findOne({
        where: [
          { employee_id: employeeIdArray },
          { $not: { type: 'withdraw' } },
          Sequelize.where(Sequelize.fn('YEAR', Sequelize.col('created_at')), `${year}`),
          Sequelize.where(Sequelize.fn('MONTH', Sequelize.col('created_at')), `${month}`)
        ],
        attributes: [[Sequelize.fn('SUM', Sequelize.literal('`debet`-`kredit`')), 'total_salary']]
      });
      const withdrawData = await JournalDetail.findAll({
        where: { status: 1 },
        include: {
          model: Journals,
          attributes: ['type', 'employee_id', 'description'],
          where: [
            { employee_id: employeeIdArray, type: 'withdraw' },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('journal_details.created_at'), '%Y-%m'),
              `${year}-${month}`
            )
          ]
        }
      });
      if (withdrawData.length) {
        for (let i = 0; i < withdrawData.length; i++) {
          depositTotal += withdrawData[i].total;
        }
      }
      const payload = Object.assign(
        {},
        {
          id: companyId,
          codename: company.codename,
          company_active: company.active,
          month: month,
          year: year,
          total_salary: journalData.dataValues.total_salary - depositTotal,
          withdraw_candidate: depositTotal.toString()
        }
      );
      return res
        .status(200)
        .json(response(true, 'Deposit summary has been successfully retrieved', payload));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = dashboardService;

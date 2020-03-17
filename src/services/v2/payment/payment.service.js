require('module-alias/register');
const { response } = require('@helpers');
const {
  journals: Journals,
  employees: Employees,
  journal_details: JournalDetails
} = require('@models');
const Sequelize = require('sequelize');
const { Op } = Sequelize;

const payment = {
  getFee: async (req, res) => {
    const { company_id } = req.params;
    try {
      let subscribeTotal = null;
      let paymentTotal = null;
      let employees = [];
      let employeeIdArray = [];
      let allWithdrawData = [];
      let allWithdrawTotal = 0;

      // Find Latest Payment that Truely Balancing Journal
      const balanceDate = await Journals.findOne({
        attributes: [[Sequelize.fn('max', Sequelize.col('journals.created_at')), 'created_at']],
        where: { balance: 1, type: 'payment' },
        include: { model: Employees, attributes: [], where: { company_id } },
        group: ['journals.employee_id', 'employee.id']
      });

      employees = await Employees.findAll({
        where: { company_id, flag: 3 }
      });
      for (const data of employees) {
        employeeIdArray.push(data.id);
      }

      paymentTotal = await Journals.findOne({
        where: [
          { employee_id: employeeIdArray },
          { type: 'payment' },
          balanceDate !== null && {
            created_at: {
              [Op.gt]: Sequelize.fn('DATE_FORMAT', balanceDate.created_at, '%Y-%m-%d %H:%i:%S')
            }
          }
        ],
        attributes: [[Sequelize.fn('SUM', Sequelize.col('debet')), 'total']]
      });

      subscribeTotal = await Journals.findOne({
        where: [
          { employee_id: employeeIdArray },
          { type: 'subscribe' },
          balanceDate !== null && {
            created_at: {
              [Op.gt]: Sequelize.fn('DATE_FORMAT', balanceDate.created_at, '%Y-%m-%d %H:%i:%S')
            }
          }
        ],
        attributes: [[Sequelize.fn('SUM', Sequelize.col('kredit')), 'total']]
      });

      allWithdrawData = await JournalDetails.findAll({
        where: { status: 1 },
        include: {
          model: Journals,
          attributes: [],
          where: [
            { employee_id: employeeIdArray, type: 'withdraw' },
            balanceDate !== null && {
              created_at: {
                [Op.gt]: Sequelize.fn('DATE_FORMAT', balanceDate.created_at, '%Y-%m-%d %H:%i:%S')
              }
            }
          ]
        }
      });
      if (allWithdrawData.length) {
        for (const data of allWithdrawData) {
          allWithdrawTotal += data.total;
        }
      }
      const compose = {
        subscribe_total: subscribeTotal.dataValues.total
          ? parseInt(subscribeTotal.dataValues.total)
          : 0,
        withdraw_total: allWithdrawTotal,
        payment: paymentTotal.dataValues.total ? parseInt(paymentTotal.dataValues.total) : 0
      };
      return res.status(200).json(response(true, 'Data tunggakan berhasil diterima', compose));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = payment;

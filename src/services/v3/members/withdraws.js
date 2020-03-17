require('module-alias/register');
const { response, dateProcessor, dateConverter } = require('@helpers');
const {
  users: User,
  employees: Employee,
  company_settings: CompanySetting,
  journals: Journals,
  journal_details: JournalDetails,
  promos: Promo,
  promo_details: PromoDetail
} = require('@models');
const Sequelize = require('sequelize');
const { Op } = Sequelize;

const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const withdraws = {
  create: async (req, res) => {
    const { employee_id } = req.params;
    const { data } = req.body;

    const today = dateConverter(new Date());
    let promo;
    let journalDetailPayload = {};
    try {
      const employee = await Employee.findOne({
        where: { id: employee_id },
        include: {
          model: User
        }
      });
      if (!employee) {
        return res.status(400).json(response(false, 'Employee data not found'));
      }
      const { company_id: companyId, id: employeeId } = employee;
      // Get Company Payroll Date
      const payrollDate = await CompanySetting.findOne({
        where: { company_id: companyId },
        attributes: ['payroll_date']
      });
      const dateObject = dateProcessor.getRangedDate(payrollDate.payroll_date);
      const { dateStart, dateEnd } = dateObject;

      // Count Net Salary for Withdraw Validation
      let debit = 0;
      let credit = 0;
      let rangedGrossWithdraws = 0;
      const rangedJournalData = await Journals.findAll({
        where: [
          {
            $not: {
              type: 'withdraw'
            }
          },
          { employee_id: employeeId },
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
        attributes: ['type', 'debet', 'kredit', 'description', 'created_at']
      });

      const rangedWithdrawData = await JournalDetails.findAll({
        where: { status: { [Op.ne]: -1 } },
        include: {
          model: Journals,
          attributes: ['type', 'employee_id', 'description'],
          where: [
            { employee_id: employeeId, type: 'withdraw' },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('journal_details.created_at'), '%Y-%m-%d'),
              '>=',
              dateStart
            ),
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('journal_details.created_at'), '%Y-%m-%d'),
              '<=',
              dateEnd
            )
          ]
        }
      });

      rangedJournalData.map(val => {
        debit += val.debet;
        credit += val.kredit;
      });

      if (rangedWithdrawData.length > 0) {
        for (let i = 0; i < rangedWithdrawData.length; i++) {
          rangedGrossWithdraws += rangedWithdrawData[i].total;
        }
      }

      let ranged_nett_salary = debit - credit;
      ranged_nett_salary = ranged_nett_salary - rangedGrossWithdraws;
      ranged_nett_salary = ranged_nett_salary * 0.8;

      if (ranged_nett_salary < 400000) {
        return res.status(400).json(response(false, 'Jumlah upah anda tidak mencukupi'));
      }

      // Increment promo usage
      if (data.promo_id) {
        promo = await Promo.findOne({
          attributes: [
            'id',
            'code',
            'type',
            'amount',
            'effective_date',
            'expired_date',
            'limit',
            'usage'
          ],
          where: [
            Sequelize.where(Sequelize.col('usage'), '<', Sequelize.col('limit')),
            {
              id: data.promo_id,
              effective_date: { [Op.lte]: today },
              expired_date: { [Op.gte]: today }
            }
          ]
        });
        if (!promo) {
          return res.status(400).json(response(false, 'Promo sudah tidak berlaku'));
        }

        await Promo.increment('usage', { where: { id: data.promo_id } });

        await PromoDetail.create({ employee_id, promo_id: promo.id });

        journalDetailPayload.promo_id = promo.id;
        journalDetailPayload.promo_applied = promo.amount;
      }

      const journal = await Journals.create({
        employee_id: employeeId,
        type: 'withdraw'
      });

      journalDetailPayload = Object.assign({}, journalDetailPayload, {
        journal_id: journal.id,
        tax: data.tax,
        fee: data.fee,
        total: data.total_amount,
        total_nett: data.total_nett,
        last_salary: ranged_nett_salary,
        bank_name: data.bank_name || null,
        account_number: data.account_number || null
      });

      const journalDetails = await JournalDetails.create(journalDetailPayload);

      if (!journal && !journalDetails) {
        return res.status(400).json(response(true, 'Can not create withdraw'));
      }

      //SEND EMAIL CONFIRMATION
      observe.emit(EVENT.WITHDRAW_REQUEST, {
        userId: employee.user.id, //
        companyId: employee.company_id,
        today,
        totalWithdraw: journalDetails.total
      });

      return res
        .status(200)
        .json(response(true, 'Withdraw has been successfully created', journalDetails));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = withdraws;

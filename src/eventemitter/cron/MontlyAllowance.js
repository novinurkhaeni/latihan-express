const {
  employees: Employee,
  company_settings: CompanySetting,
  companies: Company,
  salary_groups: SalaryGroup,
  allowance: Allowance,
  journals: Journal
} = require('@models');
const { dateConverter } = require('@helpers');

const EVENT = require('../constants');

class CronMonthlyAllowance {
  constructor(observable) {
    this.observable = observable;
  }
  listenCronMonthlyAllowance() {
    this.observable.addListener(EVENT.CRON_MONTHLY_ALLOWANCE, async () => {
      let date = new Date();
      date = new Date(`${date} -0700`);
      const payrollDate = date.getDate();
      const data = await Employee.findAll({
        where: { flag: 3, active: 1 },
        include: [
          {
            model: Company,
            required: true,
            attributes: ['id'],
            include: {
              model: CompanySetting,
              where: { payroll_date: payrollDate },
              attributes: ['id', 'payroll_date'],
              as: 'setting'
            }
          },
          {
            model: SalaryGroup,
            required: true,
            include: {
              model: Allowance,
              where: { type: 2 },
              required: false
            }
          }
        ]
      });
      const payload = [];
      for (const employee of data) {
        // Monthly Allowance
        let amount = 0;
        let compose = {};
        const salaryGroup = employee.salary_groups[0];
        if (salaryGroup.allowances.length) {
          salaryGroup.allowances.forEach(val => (amount += val.amount));
          compose = {
            employee_id: employee.id,
            type: 'monthlyAllowance',
            debet: amount,
            kredit: 0,
            description: `Penambahan tunjangan bulanan pada tanggal ${dateConverter(date)}`
          };
          payload.push(compose);
        }
        // BPJS Allowance
        amount = 0;
        amount =
          (salaryGroup.bpjs_allowance || 0) +
          (salaryGroup.jkk_allowance || 0) +
          (salaryGroup.jkm_allowance || 0) +
          (salaryGroup.jht_allowance || 0);
        if (amount) {
          compose = {
            employee_id: employee.id,
            type: 'bpjs',
            debet: amount,
            kredit: 0,
            description: `Penambahan tunjangan BPJS pada tanggal ${dateConverter(date)}`
          };
          payload.push(compose);
        }
        // BPJS Deduction
        amount = 0;
        amount =
          (salaryGroup.jkk_reduction || 0) +
          (salaryGroup.jkm_reduction || 0) +
          (salaryGroup.jht_reduction || 0);
        if (amount) {
          compose = {
            employee_id: employee.id,
            type: 'bpjs',
            debet: 0,
            kredit: amount,
            description: `Penambahan deduksi BPJS pada tanggal ${dateConverter(date)}`
          };
          payload.push(compose);
        }
      }
      await Journal.bulkCreate(payload);
    });
  }
}

module.exports = CronMonthlyAllowance;

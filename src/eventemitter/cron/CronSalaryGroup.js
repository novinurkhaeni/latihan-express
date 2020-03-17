const {
  companies: Companies,
  company_settings: CompanySetting,
  cron_salary_groups: CronSalaryGroups,
  salary_groups: SalaryGroup
} = require('@models');

const EVENT = require('../constants');

class CronSalaryGroup {
  constructor(observable) {
    this.observable = observable;
  }
  listenCronSalaryGroup() {
    this.observable.addListener(EVENT.CRON_SALARY_GROUP, async () => {
      let date = new Date();
      date = new Date(`${date} -0700`).getDate();
      const cronCandidates = await CronSalaryGroups.findAll({
        include: {
          model: Companies,
          required: true,
          include: {
            model: CompanySetting,
            as: 'setting',
            where: { payroll_date: date }
          }
        }
      });
      cronCandidates.forEach(async data => {
        const compose = {
          salary_type: data.salary_type,
          salary: data.salary,
          transport_allowance: data.transport_allowance,
          lunch_allowance: data.lunch_allowance
        };
        await SalaryGroup.update(compose, { where: { id: data.salary_id } });
        await CronSalaryGroups.destroy({ where: { id: data.id } });
      });
    });
  }
}

module.exports = CronSalaryGroup;

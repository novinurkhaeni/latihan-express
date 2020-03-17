const {
  employees: EmployeeModel,
  company_settings: CompanySetting,
  companies: Company,
  users: User
} = require('@models');

const EVENT = require('../constants');

class CronDeleteEmployee {
  constructor(observable) {
    this.observable = observable;
  }
  listenCronDeleteEmployee() {
    this.observable.addListener(EVENT.CRON_DELETE_EMPLOYEE, async () => {
      let date = new Date();
      date = new Date(`${date} -0700`).getDate();

      const employee = await EmployeeModel.findAll({
        where: { active: 0 },
        include: [
          {
            model: Company,
            required: true,
            include: [
              {
                model: CompanySetting,
                as: 'setting',
                where: { payroll_date: date },
                attributes: ['id'],
                required: true
              }
            ]
          }
        ]
      });

      employee.forEach(async data => {
        await User.destroy({ where: { id: data.user_id } });
      });
    });
  }
}

module.exports = CronDeleteEmployee;

const {
  sequelize,
  companies: Companies,
  employees: Employees,
  company_settings: CompanySetting,
  cron_employees: CronEmployees
} = require('@models');
const EVENT = require('../constants');

class CronChangeEmployeeCompanyId {
  constructor(observable) {
    this.observable = observable;
  }

  listenCronChangeEmployeeCompanyId() {
    this.observable.addListener(EVENT.CRON_CHANGE_EMPLOYEE_COMPANY_ID, async () => {
      let date = new Date();
      date = new Date(`${date} -0700`).getDate();

      const cronCandidates = await CronEmployees.findAll({
        include: {
          model: Companies,
          required: true,
          include: [{ model: CompanySetting, as: 'setting', where: { payroll_date: date } }]
        }
      });

      if (cronCandidates.length > 0) {
        cronCandidates.forEach(async data => {
          //using "unmanaged transaction", which requires user to call commit and rollback manually
          let transaction = await sequelize.transaction();
          try {
            // step 1 destroy cron employee
            await CronEmployees.destroy({ where: { employee_id: data.employee_id }, transaction });

            // step 2 update employee by transaction
            await Employees.update(
              { company_id: data.company_id },
              { returning: true, where: { id: data.employee_id } },
              { transaction }
            );

            // commit
            await transaction.commit();
          } catch (err) {
            // Rollback transaction if any errors were encountered
            if (err) await transaction.rollback();
          }
        });
      }
    });
  }
}

module.exports = CronChangeEmployeeCompanyId;

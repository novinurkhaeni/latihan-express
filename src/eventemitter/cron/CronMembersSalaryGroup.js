const {
  employees: EmployeeModel,
  cron_members_salary_groups: CronMembersSalaryGroupModel,
  salary_details: SalaryDetail,
  company_settings: CompanySetting,
  companies: Company,
  salary_groups: SalaryGroup
} = require('@models');

const EVENT = require('../constants');

class CronMembersSalaryGroup {
  constructor(observable) {
    this.observable = observable;
  }
  listenCronMembersSalaryGroup() {
    this.observable.addListener(EVENT.CRON_MEMBERS_SALARY_GROUP, async () => {
      let date = new Date();
      date = new Date(`${date} -0700`).getDate();
      const employeeModel = await CronMembersSalaryGroupModel.findAll({
        include: {
          model: EmployeeModel,
          required: true,
          include: [
            {
              model: Company,
              required: true,
              include: {
                model: CompanySetting,
                attributes: ['payroll_date'],
                as: 'setting',
                where: { payroll_date: date },
                reuired: true
              }
            },
            { model: SalaryGroup }
          ]
        }
      });

      employeeModel.forEach(async data => {
        await SalaryDetail.update(
          { salary_id: data.salary_id },
          { where: { id: data.employee.salary_groups[0].salary_details.id } }
        );
        await CronMembersSalaryGroupModel.destroy({ where: { id: data.id } });
      });
    });
  }
}

module.exports = CronMembersSalaryGroup;

require('module-alias/register');
const { response } = require('@helpers');
const {
  company_settings: CompanySettingModel,
  companies: CompanyModel,
  employees: EmployeeModel,
  users: UserModel,
  abilities: Ability
} = require('@models');

const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const companySettingService = {
  create: async (req, res) => {
    const { data } = req.body;
    const { id: companyId } = req.params;
    const { id: user_id } = res.local.users;

    try {
      let company = await CompanyModel.findOne({
        where: {
          id: companyId
        }
      });
      if (!company) {
        return res.status(400).json(response(false, `Company with id ${companyId} is not found`));
      }
      const settingPayload = Object.assign({
        company_id: companyId,
        notif_presence_overdue: data.notif_presence_overdue,
        presence_overdue_limit: data.presence_overdue_limit,
        overwork_limit: data.overwork_limit,
        notif_overwork: data.notif_overwork,
        rest_limit: data.rest_limit,
        notif_work_schedule: data.notif_work_schedule,
        payroll_date: data.payroll_date,
        late_deduction: data.late_deduction,
        home_early_deduction: data.home_early_deduction
      });

      company = await CompanySettingModel.findOne({
        where: { company_id: companyId }
      });
      if (company) {
        return res
          .status(400)
          .json(response(false, `Failed, company settings with id ${companyId} has already exist`));
      }
      company = await CompanySettingModel.create(settingPayload);

      const employee = await EmployeeModel.create({
        company_id: companyId,
        salary: null,
        user_id,
        role: 1,
        flag: 3,
        gajiandulu_status: 0
      });

      await UserModel.update({ registration_complete: 1 }, { where: { id: user_id } });

      await CompanyModel.update({ registration_complete: 1 }, { where: { id: companyId } });

      // Create Ability Record
      await Ability.create({ employee_id: employee.id });

      company.dataValues.employee_id = employee.id;
      company.dataValues.role = employee.role;

      // SEND NOTIFICATION WELCOME
      observe.emit(EVENT.SEND_WELCOME, {
        userId: user_id,
        employeeId: employee.id
      });

      return res
        .status(200)
        .json(response(true, 'Company settings has been successfully saved', company));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = companySettingService;

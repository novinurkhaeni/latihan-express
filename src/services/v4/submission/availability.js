require('module-alias/register');
const {
  Sequelize: { Op }
} = require('sequelize');

const { response } = require('@helpers');
const {
  submissions: Submission,
  companies: Company,
  employees: Employee,
  presences: Presence,
  schedule_swaps: ScheduleSwap,
  defined_schedules: DefinedSchedule
} = require('@models');

const availability = {
  get: async (req, res) => {
    const { companyParentId } = res.local.users;
    try {
      // Get All Companies
      let companies = await Company.findAll({
        where: { parent_company_id: companyParentId },
        attributes: ['id']
      });
      const companyIds = [];
      for (const company of companies) {
        companyIds.push(company.id);
      }
      // Get All Employees
      const employees = await Employee.findAll({
        where: { company_id: companyIds, active: 1 },
        attributes: ['id']
      });
      const employeeIds = [];
      for (const employee of employees) {
        employeeIds.push(employee.id);
      }
      /**
       * Presence Submission Section
       */
      const submissions = await Submission.findAll({
        where: { employee_id: employeeIds, type: { [Op.or]: [2, 6] }, status: 0 }
      });
      const presences = await Presence.findAll({
        where: { is_custom_presence: 1, employee_id: employeeIds }
      });
      const joinedPresenceSubmissions = submissions.concat(presences);
      /**
       * Schedule Submission Section
       */
      const schedules = await DefinedSchedule.findAll({
        where: { employee_id: employeeIds, status: 1 }
      });
      const scheduleSwaps = await ScheduleSwap.findAll({
        where: { company_id: companyIds, status: 1 }
      });
      const joinedScheduleSubmissions = schedules.concat(scheduleSwaps);
      const responses = {
        is_presence_submission_exist: joinedPresenceSubmissions.length !== 0,
        is_schedule_submission_exist: joinedScheduleSubmissions.length !== 0
      };
      return res
        .status(200)
        .json(response(true, 'Berhasil mendapatkan data ketersediaan pengajuan', responses));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      } else {
        return res.status(400).json(response(false, error.message));
      }
    }
  }
};

module.exports = availability;

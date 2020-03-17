/* eslint-disable indent */
require('module-alias/register');
const { Op } = require('sequelize');
const { response, demoGenerator } = require('@helpers');
const { users: UserModel, companies: CompaniesModel } = require('@models');

const demoService = {
  create: async (req, res) => {
    const { user_id: userID, company_id: companyID } = req.query;
    try {
      // get is this user are never done demo.
      const isDoneDemo = await UserModel.findOne({
        where: { [Op.and]: [{ id: userID }, { is_has_dummy: 1 }] }
      });
      if (isDoneDemo) throw new Error('This user have already done demo!');

      const companyLocation = await CompaniesModel.findOne({
        where: { [Op.and]: [{ id: companyID }, { active: 1 }] }
      });
      if (!companyLocation) throw new Error(companyLocation);

      // Generate user & employee demo data
      const employeeArray = await demoGenerator.generateUserDemo(companyID);
      if (!employeeArray) throw new Error(employeeArray);

      // Generate shift and jadwal demo
      let envArray = await demoGenerator.generateEnvironmentDemo(companyID, {
        companies: companyLocation
      });
      if (!envArray) throw new Error(envArray);

      // Generate ceklog employee
      const presResult = await demoGenerator.registerEmployeeToPresence({
        employees: employeeArray,
        companies: companyLocation
      });
      if (!presResult) throw new Error(presResult);

      // Generate 'jadwal' (define_schedule)
      const scheResult = await demoGenerator.generateScheduleDemo({ employees: employeeArray });
      if (!scheResult) throw new Error(scheResult);

      // Register existing shift to employee schedule
      const shiftDetailResult = await demoGenerator.registerShiftToScheduleDetail({
        schedule_shifts: envArray,
        defined_schedules: scheResult
      });
      if (!shiftDetailResult) throw new Error(shiftDetailResult);

      // Mark this user as pass demo tutorial
      await UserModel.update({ is_has_dummy: 1 }, { where: { id: userID } });

      return res.status(200).json(response(true, 'Generate user demo data success!'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  hasDone: async (req, res) => {
    const { user_id: userId } = req.query;
    try {
      const getDoneDemo = await UserModel.findOne({
        where: { [Op.and]: [{ id: userId }, { is_has_dummy: 0 }] },
        attributes: ['id', 'full_name', 'email', 'is_has_dummy']
      });
      return res.status(200).json(response(true, 'this user has already done demo!', getDoneDemo));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = demoService;

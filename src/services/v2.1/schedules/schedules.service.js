/* eslint-disable indent */
require('module-alias/register');
const {
  response,
  scheduleTemplates: scheduleTemplatesHelpers,
  definedSchedules: definedSchedulesHelpers
} = require('@helpers');
const { companies: CompanyModel, employees: Employee } = require('@models');

const scheduleService = {
  getSchedules: async (req, res) => {
    const { company_id: companyId } = req.params;
    const { date, branch } = req.query;
    const { employeeId } = res.local.users;
    const companyIdArr = companyId.split(',');
    const companyBranchId = branch.split(',');
    try {
      const companyData = await CompanyModel.findAll({
        where: {
          id: companyIdArr
        }
      });
      if (companyData.length <= 0) {
        return res.status(400).json(response(false, `Failed to fetch: company data doesn't exist`));
      }
      const isMember = await Employee.findOne({
        where: { id: employeeId, role: 2, active: 1 }
      });
      const scheduleTemplates = await scheduleTemplatesHelpers(
        date,
        employeeId,
        companyIdArr,
        isMember,
        companyBranchId
      );
      const definedSchedules = await definedSchedulesHelpers(
        date,
        companyIdArr,
        isMember && employeeId,
        companyBranchId,
        false,
        false,
        true,
        false,
        false
      );
      const schedules = scheduleTemplates.concat(definedSchedules);
      if (!schedules || schedules.length <= 0) {
        return res.status(400).json(response(false, `Jadwal Tidak Ditemukan`));
      }

      let definedStartTime;
      let definedEndTime;
      let definedStart;
      let definedEnd;
      let scheduleObj;
      let scheduleArray = [];
      const today = new Date();
      for (let i = 0; i < schedules.length; i++) {
        // Handle Response from Schedule Created With V2
        if (schedules[i].shift) {
          let isDateTommorow = schedules[i].shift.schedule_shift.is_tommorow;
          definedStartTime = schedules[i].shift.schedule_shift.start_time.split(':');
          definedEndTime = schedules[i].shift.schedule_shift.end_time.split(':');
          definedStart = new Date(
            isDateTommorow ? today.getFullYear() : 0,
            isDateTommorow ? today.getMonth() : 0,
            isDateTommorow ? today.getDate() : 0,
            definedStartTime[0],
            definedStartTime[1],
            0
          );
          definedEnd = new Date(
            isDateTommorow ? today.getFullYear() : 0,
            isDateTommorow ? today.getMonth() : 0,
            isDateTommorow ? today.getDate() + 1 : 0,
            definedEndTime[0],
            definedEndTime[1],
            0
          );

          scheduleObj = {
            id: schedules[i].start_date ? schedules[i].id : false,
            defined_id: schedules[i].presence_date ? schedules[i].id : false,
            employee: schedules[i].employee
              ? {
                  id: schedules[i].employee.id,
                  full_name: schedules[i].employee.user.full_name,
                  assets: schedules[i].employee.assets
                }
              : null,
            company: schedules[i].company,
            schedule_date: schedules[i].presence_date,
            shift_name: schedules[i].shift.schedule_shift.shift_name,
            schedule_start: schedules[i].shift.schedule_shift.start_time,
            schedule_end: schedules[i].shift.schedule_shift.end_time,
            workhour: Math.abs(definedStart - definedEnd) / 36e5,
            start_time_info: schedules[i].dataValues.start_time_info || null,
            end_time_info: schedules[i].dataValues.end_time_info || null,
            note: schedules[i].notes ? schedules[i].notes.note : null,
            color: schedules[i].shift.schedule_shift.color
          };
          scheduleArray.push(scheduleObj);
        } else {
          // Handle Response from Schedule Created With V1
          definedStartTime = schedules[i].presence_start
            ? schedules[i].presence_start.split(':')
            : schedules[i].start_time.split(':');
          definedEndTime = schedules[i].presence_end
            ? schedules[i].presence_end.split(':')
            : schedules[i].end_time.split(':');
          definedStart = new Date(0, 0, 0, definedStartTime[0], definedStartTime[1], 0);
          definedEnd = new Date(0, 0, 0, definedEndTime[0], definedEndTime[1], 0);

          scheduleObj = {
            id: schedules[i].start_date ? schedules[i].id : false,
            defined_id: schedules[i].presence_date ? schedules[i].id : false,
            employee: {
              id: schedules[i].employee.id,
              full_name: schedules[i].employee.user.full_name,
              assets: schedules[i].employee.assets
            },
            company: schedules[i].company,
            schedule_date: schedules[i].presence_date,
            schedule_start: schedules[i].presence_start
              ? schedules[i].presence_start
              : schedules[i].start_time,
            schedule_end: schedules[i].presence_end
              ? schedules[i].presence_end
              : schedules[i].end_time,
            workhour: Math.abs(definedStart - definedEnd) / 36e5,
            start_time_info: null,
            end_time_info: null,
            color: schedules[i].shift ? schedules[i].shift.schedule_shift.color : null
          };
          scheduleArray.push(scheduleObj);
        }
      }
      scheduleArray.sort((prev, next) => {
        if (prev.employee === null) return -1;
        if (next.employee === null) return 1;
        // Sort By Clock ASC
        if (prev.schedule_start < next.schedule_start) return -1;
        if (prev.schedule_start > next.schedule_start) return 1;
        // Sort By Name ASC
        if (prev.employee && next.employee) {
          if (prev.employee.full_name < next.employee.full_name) return -1;
          if (prev.employee.full_name > next.employee.full_name) return 1;
        }
      });
      return res
        .status(200)
        .json(response(true, 'Schedule data have been successfully retrieved', scheduleArray));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = scheduleService;

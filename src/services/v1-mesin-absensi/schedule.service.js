require('module-alias/register');
const { response, scheduleTemplates: scheduleTemplatesHelpers } = require('@helpers');
const {
  companies: CompanyModel,
  schedule_shifts: ScheduleShift,
  defined_schedules: DefinedSchedule,
  schedule_shift_details: ScheduleShiftDetails,
  employees: Employee,
  users: User,
  digital_assets: DigitalAsset
} = require('@models');

const schedules = {
  getSchedules: async (req, res) => {
    const { company_id: companyId } = req.params;
    const { date } = req.query;
    const { employeeId } = res.local.users;
    let responseData = [];

    try {
      const companyData = await CompanyModel.findOne({
        where: {
          id: companyId
        }
      });
      if (!companyData) {
        return res.status(400).json(response(false, `Failed to fetch: company data doesn't exist`));
      }
      const isMember = await Employee.findOne({
        where: { id: employeeId, role: 2 }
      });

      let scheduleTemplates = await scheduleTemplatesHelpers(date, employeeId, companyId, isMember);

      // If schedule template still not found, then find only the defined schedule
      if (!scheduleTemplates || scheduleTemplates.length <= 0) {
        scheduleTemplates = await DefinedSchedule.findAll({
          where:
            isMember === null
              ? { presence_date: date }
              : { presence_date: date, employee_id: employeeId },
          include: [
            {
              model: Employee,
              where: { company_id: companyId },
              attributes: ['id', 'user_id'],
              include: [
                {
                  model: User,
                  attributes: ['full_name']
                },
                {
                  model: DigitalAsset,
                  required: false,
                  attributes: ['url', 'type'],
                  where: {
                    type: 'avatar'
                  },
                  as: 'assets'
                }
              ]
            },
            {
              model: ScheduleShiftDetails,
              where: { schedule_type: 'defined_Schedules' },
              as: 'shift',
              include: {
                model: ScheduleShift,
                attributes: ['start_time', 'end_time']
              }
            }
          ]
        });
        // return res
        //   .status(400)
        //   .json(response(false, 'Tidak ada jadwal tersedia', scheduleTemplates));

        if (!scheduleTemplates || scheduleTemplates.length <= 0) {
          return res.status(400).json(response(false, 'Tidak ada jadwal tersedia'));
        }

        let definedStartTime;
        let definedEndTime;
        let definedStart;
        let definedEnd;
        let scheduleObj;
        let scheduleArray = [];

        for (let i = 0; i < scheduleTemplates.length; i++) {
          definedStartTime = scheduleTemplates[i].shift.schedule_shift.start_time.split(':');
          definedEndTime = scheduleTemplates[i].shift.schedule_shift.end_time.split(':');
          definedStart = new Date(0, 0, 0, definedStartTime[0], definedStartTime[1], 0);
          definedEnd = new Date(0, 0, 0, definedEndTime[0], definedEndTime[1], 0);

          scheduleObj = {
            id: false,
            defined_id: scheduleTemplates[i].id,
            employee: {
              id: scheduleTemplates[i].employee.id,
              full_name: scheduleTemplates[i].employee.user.full_name,
              assets: scheduleTemplates[i].employee.assets
            },
            schedule_date: scheduleTemplates[i].presence_date,
            schedule_start: scheduleTemplates[i].shift.schedule_shift.start_time,
            schedule_end: scheduleTemplates[i].shift.schedule_shift.end_time,
            workhour: Math.abs(definedStart - definedEnd) / 36e5
          };
          scheduleArray.push(scheduleObj);
        }

        return res
          .status(200)
          .json(response(true, 'Schedule data have been successfully retrieved', scheduleArray));
      }

      let objectData = {};
      if (scheduleTemplates.length > 0) {
        const definedData = await DefinedSchedule.findAll({
          where:
            isMember === null
              ? { presence_date: date }
              : { presence_date: date, employee_id: employeeId },
          include: [
            {
              model: Employee,
              where: { company_id: companyId },
              attributes: ['id', 'user_id'],
              include: [
                {
                  model: User,
                  attributes: ['full_name']
                },
                {
                  model: DigitalAsset,
                  required: false,
                  attributes: ['url', 'type'],
                  where: {
                    type: 'avatar'
                  },
                  as: 'assets'
                }
              ]
            },
            {
              model: ScheduleShiftDetails,
              where: { schedule_type: 'defined_Schedules' },
              as: 'shift',
              include: {
                model: ScheduleShift,
                attributes: ['start_time', 'end_time']
              }
            }
          ]
        });

        let definedStartTime;
        let definedEndTime;
        let definedStart;
        let definedEnd;
        let scheduleObj;

        for (let i = 0; i < definedData.length; i++) {
          definedStartTime = definedData[i].shift.schedule_shift.start_time.split(':');
          definedEndTime = definedData[i].shift.schedule_shift.end_time.split(':');
          definedStart = new Date(0, 0, 0, definedStartTime[0], definedStartTime[1], 0);
          definedEnd = new Date(0, 0, 0, definedEndTime[0], definedEndTime[1], 0);

          scheduleObj = {
            id: false,
            defined_id: definedData[i].id,
            employee: {
              id: definedData[i].employee.id,
              full_name: definedData[i].employee.user.full_name,
              assets: definedData[i].employee.assets
            },
            schedule_date: definedData[i].presence_date,
            schedule_start: definedData[i].shift.schedule_shift.start_time,
            schedule_end: definedData[i].shift.schedule_shift.end_time,
            workhour: Math.abs(definedStart - definedEnd) / 36e5
          };
          responseData.push(scheduleObj);
        }

        for (let i = 0; i < scheduleTemplates.length; i++) {
          /* eslint-disable */
          let startTime =
            scheduleTemplates[i].employee.defined_schedules.length > 0
              ? scheduleTemplates[
                  i
                ].employee.defined_schedules[0].shift.schedule_shift.start_time.split(':')
              : scheduleTemplates[i].shift.schedule_shift.start_time.split(':');
          let endTime =
            scheduleTemplates[i].employee.defined_schedules.length > 0
              ? scheduleTemplates[
                  i
                ].employee.defined_schedules[0].shift.schedule_shift.end_time.split(':')
              : scheduleTemplates[i].shift.schedule_shift.end_time.split(':');
          /* eslint-enable */
          let start = new Date(0, 0, 0, startTime[0], startTime[1], 0);
          let end = new Date(0, 0, 0, endTime[0], endTime[1], 0);

          /* eslint-disable */
          objectData = {
            id: scheduleTemplates[i].id,
            defined_id:
              scheduleTemplates[i].employee.defined_schedules.length > 0 &&
              scheduleTemplates[i].employee.defined_schedules[0].id,
            employee: {
              id: scheduleTemplates[i].employee.id,
              full_name: scheduleTemplates[i].employee.user.full_name,
              assets: scheduleTemplates[i].employee.assets
            },
            schedule_date:
              scheduleTemplates[i].employee.defined_schedules.length > 0
                ? scheduleTemplates[i].employee.defined_schedules[0].presence_date
                : date,
            schedule_start:
              scheduleTemplates[i].employee.defined_schedules.length > 0
                ? scheduleTemplates[i].employee.defined_schedules[0].shift.schedule_shift.start_time
                : scheduleTemplates[i].shift.schedule_shift.start_time,
            schedule_end:
              scheduleTemplates[i].employee.defined_schedules.length > 0
                ? scheduleTemplates[i].employee.defined_schedules[0].shift.schedule_shift.end_time
                : scheduleTemplates[i].shift.schedule_shift.end_time,
            workhour: Math.abs(start - end) / 36e5
          };
          /* eslint-enable */
          responseData.push(objectData);
        }
      }

      return res
        .status(200)
        .json(response(true, 'Schedule data have been successfully retrieved', responseData));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = schedules;

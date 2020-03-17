require('module-alias/register');
const dateConverter = require('./dateConverter');
const moment = require('moment');
const {
  users: UserModel,
  employees: EmployeeModel,
  schedule_shifts: ShiftModel,
  presences: PresenceModel,
  defined_schedules: DefineScheduleModel,
  schedule_shift_details: ScheduleShiftDetailModel
} = require('@models');

const DB_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const DB_TIMEZONE_OFFSET = '07'; // DB AUTO ASSIGN TO GMT +7

// To handle increment/decrement date now
const getTimeDate = (day, isSubstract = true) => {
  let now = new Date();
  if (isSubstract) {
    return moment(now)
      .subtract(day, 'day')
      .format('YYYY-MM-DD');
  }
  return moment(now)
    .add(day, 'day')
    .format('YYYY-MM-DD');
};
const getCurrentTimeRegistration = (nTimezone, is24HourFormat) => {
  if (is24HourFormat) return moment.tz(new Date(), nTimezone).format('HH:mm');

  return moment.tz(new Date(), nTimezone).format('hh:mm');
};

const getDummyShiftTimeType = (nObject, nCurrentTime, isHourOnly) => {
  let shiftResult = nObject;

  if (nCurrentTime > '08:00' && nCurrentTime <= '16:00') {
    shiftResult = Object.assign(shiftResult, { start_time: '08:00', end_time: '16:00' }); // pagi
  } else if (nCurrentTime > '16:00' && nCurrentTime <= '24:00') {
    shiftResult = Object.assign(shiftResult, { start_time: '16:00', end_time: '00:00' }); // siang
  } else {
    shiftResult = Object.assign(shiftResult, { start_time: '00:00', end_time: '08:00' }); // malam
  }

  return shiftResult;
};

const getTimeCeklog = nCurrentTime => {
  let shiftResult = {};
  if (nCurrentTime > '08:00' && nCurrentTime <= '16:00') {
    shiftResult = Object.assign(shiftResult, { start_time: '08:00', end_time: '16:00' }); // pagi
  } else if (nCurrentTime > '16:00' && nCurrentTime <= '24:00') {
    shiftResult = Object.assign(shiftResult, { start_time: '16:00', end_time: '24:00' }); // siang
  } else {
    shiftResult = Object.assign(shiftResult, { start_time: '24:00', end_time: '08:00' }); // malam
  }

  let start = shiftResult.start_time.split(':');
  let end = shiftResult.end_time.split(':');

  return {
    start_time:
      start[0] - DB_TIMEZONE_OFFSET < '0'
        ? 24 - Math.abs(start[0] - DB_TIMEZONE_OFFSET)
        : start[0] - DB_TIMEZONE_OFFSET,
    end_time:
      end[0] - DB_TIMEZONE_OFFSET < '0'
        ? 24 - Math.abs(end[0] - DB_TIMEZONE_OFFSET)
        : end[0] - DB_TIMEZONE_OFFSET
  };
};

const demoGenerator = {
  generateUserDemo: async companyID => {
    try {
      let userArray = [];
      let mEmployeeArray = [];

      // Generate new User with dummy data
      let userData = userDummyData(companyID);

      const result = await UserModel.bulkCreate(userData);
      if (!result) throw new Error(result);

      if (result.length) userArray = result.map(e => e);

      // Register created dummy user as employee to this company
      for (const user of userArray) {
        let payloadEmployee = {
          company_id: companyID,
          user_id: user.id,
          role: 2,
          salary: 0,
          workdays: 0,
          daily_salary: 0,
          daily_salary_with_meal: 0,
          meal_allowance: 0,
          flag: 3,
          is_dummy: 1
        };

        await EmployeeModel.create(payloadEmployee).then(e => {
          mEmployeeArray.push(e);
        });

        if (!mEmployeeArray) {
          console.error(`failed to Register dummy user as company ${companyID}`); //eslint-disable-line
        }
      }

      return mEmployeeArray;
    } catch (error) {
      console.error(`generate user dummy error ${error}`); //eslint-disable-line
      return error;
    }
  },
  generateEnvironmentDemo: async (companyID, { companies: compLoc }) => {
    try {
      // Get current registration time
      const currentTime = await getCurrentTimeRegistration(compLoc.timezone, true);

      // Generating shift schedule demo
      const shiftArray = dummyShiftSchedule(companyID, currentTime);

      let result = await ShiftModel.bulkCreate(shiftArray);
      if (!result) throw new Error('Error failed to create bulk shift!');

      return result;
    } catch (error) {
      console.error(`generate dummy shift error ${error}`); //eslint-disable-line
      return error.message;
    }
  },
  registerEmployeeToPresence: async ({ employees: employeeData, companies: companyLoc }) => {
    try {
      // Generate employee presence demo
      let presenceQueryData = [];

      employeeData.forEach((e, i) => {
        let presenceArray = dummyPresence(
          i,
          e.company_id,
          e.id,
          companyLoc.location,
          companyLoc.timezone
        );
        for (const rows of presenceArray) {
          presenceQueryData.push(rows);
        }
      });

      const result = await PresenceModel.bulkCreate(presenceQueryData);
      if (!result) throw new Error(`Failed to bulkCreate presence ${result}`);

      return result;
    } catch (error) {
      console.error(`generate presence dummy error ${error}`); //eslint-disable-line
      return error.message;
    }
  },
  generateScheduleDemo: async ({ employees: employeeData }) => {
    try {
      let scheduleData = [];

      // Generate defined_schedule
      for (const empl of employeeData) {
        let schedule = dummySchedule(empl.id, empl.company_id);

        let result = await DefineScheduleModel.bulkCreate(schedule);
        if (!result) throw new Error('Failed to bulkCreate schedule demo');

        scheduleData.push(result);
      }

      return scheduleData;
    } catch (error) {
      return error.message;
    }
  },
  registerShiftToScheduleDetail: async ({
    defined_schedules: schedules,
    schedule_shifts: shifts
  }) => {
    try {
      let result = [];

      let demoSchedule = schedules.flatMap(e => e); // pack into a single array
      let scheduleDetailQuery = demoSchedule.map(e => {
        return {
          shift_id: shifts[0].id,
          schedule_id: e.id,
          schedule_type: 'defined_schedules'
        };
      });

      result = await ScheduleShiftDetailModel.bulkCreate(scheduleDetailQuery);
      if (!result) throw new Error('Failed to insert bulk crate demo schedule detail data!');

      return result;
    } catch (error) {
      return error.message;
    }
  }
};

// Dummy data array
const userDummyData = companyID => {
  let userArray = [
    {
      full_name: 'Contoh Karyawan 1',
      email: `contohkaryawan1${companyID}@live.com`,
      registration_complete: 1,
      is_active_notif: 1,
      is_phone_confirmed: 1
    },
    {
      full_name: 'Contoh Karyawan 2',
      email: `contohkaryawan2${companyID}@live.com`,
      registration_complete: 1,
      is_active_notif: 1,
      is_phone_confirmed: 1
    }
  ];
  return userArray;
};

const dummyPresence = (index, compID, employeeID, compLocation, compTimezone) => {
  let lusa = getTimeDate(2, true);
  let yesterday = getTimeDate(1, true);
  let today = getTimeDate(0, true);
  let tommorrow = getTimeDate(1, false);

  let curTime = getCurrentTimeRegistration(compTimezone, true);
  let pTime = getTimeCeklog(curTime);

  const template = [
    [
      {
        company_id: compID || null,
        employee_id: employeeID,
        presence_date: lusa,
        presence_start: null,
        presence_end: null,
        checkin_location: compLocation,
        checkout_location: compLocation,
        is_absence: 1
      },
      {
        company_id: compID || null,
        employee_id: employeeID,
        presence_date: yesterday,
        presence_start: moment(yesterday + ' ' + `${pTime.start_time}:00`)
          .format(DB_FORMAT)
          .toString(),
        presence_end: moment(yesterday + ' ' + `${pTime.end_time}:00`)
          .format(DB_FORMAT)
          .toString(),
        checkin_location: compLocation,
        checkout_location: compLocation
      },
      {
        company_id: compID || null,
        employee_id: employeeID,
        presence_date: today,
        presence_start: moment(today + ' ' + `${pTime.start_time}:05`)
          .format(DB_FORMAT)
          .toString(),
        presence_end: null,
        checkin_location: compLocation,
        checkout_location: null,
        presence_overdue: 5
      },
      {
        company_id: compID || null,
        employee_id: employeeID,
        presence_date: tommorrow,
        presence_start: null,
        presence_end: null,
        checkin_location: compLocation,
        checkout_location: compLocation,
        is_permit: 1
      }
    ],
    [
      {
        company_id: compID || null,
        employee_id: employeeID,
        presence_date: lusa,
        presence_start: moment(lusa + ' ' + `${pTime.start_time}:00`)
          .format(DB_FORMAT)
          .toString(),
        presence_end: moment(lusa + ' ' + `${pTime.end_time - '01'}:55`)
          .format(DB_FORMAT)
          .toString(),
        checkin_location: compLocation,
        checkout_location: compLocation,
        home_early: 5
      },
      {
        company_id: compID || null,
        employee_id: employeeID,
        presence_date: yesterday,
        presence_start: moment(yesterday + ' ' + `${pTime.start_time}:00`)
          .format(DB_FORMAT)
          .toString(),
        presence_end: moment(yesterday + ' ' + `${pTime.end_time}:00`)
          .format(DB_FORMAT)
          .toString(),
        is_custom_presence: 1,
        checkin_location: '-4.686460, 55.762078',
        checkout_location: '-4.686460, 55.762078'
      }
    ]
  ];
  return template[index];
};

const dummySchedule = (employeeID, companyID) => {
  let scheduleData = [];

  // Allocate 1 week scedule based on WF 3.1.1 screen 1.1 - d.
  /*
   * -2: lusa, -1: yesterday, 0: current, 1-4: next following day
   */
  for (let i = -2; i < 5; i++) {
    let scheduleTemplate = {
      employee_id: employeeID,
      company_id: companyID,
      presence_date: dateConverter(getTimeDate(i))
    };

    scheduleData.push(scheduleTemplate);
  }

  return scheduleData;
};

const dummyShiftSchedule = (companyId, currentTime) => {
  let shiftResult = {
    company_id: companyId,
    shift_name: 'Contoh Shift',
    start_time: '08:00',
    end_time: '16:00',
    is_tommorow: '0',
    color: '#87CEEB',
    use_salary_per_shift: '0'
  };

  shiftResult = getDummyShiftTimeType(shiftResult, currentTime);

  // Adjust time if shift end on middle of day change
  if (shiftResult.end_time == '00:00') {
    shiftResult = Object.assign(shiftResult, { is_tommorow: '1' });
  }

  return [shiftResult];
};

module.exports = demoGenerator;

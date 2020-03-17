require('module-alias/register');
const { Sequelize } = require('sequelize');
const Moment = require('moment-timezone');
const {
  response,
  dateConverter,
  scheduleOrder,
  dateProcessor,
  countWorkdays,
  countTotalSchedule,
  definedSchedules: definedSchedulesHelper,
  scheduleTemplates: scheduleTemplatesHelper,
  presenceOverdueCheck: presenceOverdueCheckV1
} = require('@helpers');
const {
  employees: Employee,
  presences: Presence,
  companies: Company,
  company_settings: CompanySetting,
  users: User,
  salary_groups: SalaryGroup,
  allowance: Allowance,
  employee_notes: EmployeeNote,
  journals: Journal
} = require('@models');
const { Op } = Sequelize;

const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const presenceService = {
  check: async (req, res) => {
    const { employee_id } = req.params;
    let today = new Date();
    today.setHours(today.getHours() + 7);
    today = dateConverter(today);
    try {
      const employee = await Employee.findOne({
        attributes: ['company_id'],
        where: { id: employee_id }
      });
      // Users' today schedule
      const definedSchedules = await definedSchedulesHelper(
        today,
        employee.company_id,
        employee_id,
        null,
        true
      );
      const scheduleTemplates = await scheduleTemplatesHelper(
        today,
        employee_id,
        employee.company_id,
        true
      );
      const schedules = definedSchedules.concat(scheduleTemplates);

      const { hourDeviation } = scheduleOrder(schedules);

      let thisDate = new Date();
      thisDate.setHours(thisDate.getHours() + 7 - hourDeviation);
      thisDate = dateConverter(thisDate);
      const todayPresence = await Presence.findOne({
        attributes: ['employee_id', 'presence_start', 'presence_end', 'rest_start', 'rest_end'],
        order: [['id', 'DESC']],
        where: [
          {
            employee_id: employee_id,
            presence_start: { [Op.ne]: null }
          },
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('presence_date'), '%Y-%m-%d'),
            thisDate
          )
        ]
      });
      return res
        .status(200)
        .json(response(true, 'Data presensi hari ini berhasil didaptkan', todayPresence));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  checklogValidation: async (req, res, cb) => {
    const { data } = req.body;
    let presenceProcess = {
      presenceStart: null,
      presenceEnd: null,
      restStart: null,
      resEnd: null
    };
    let presenceComplete = true;
    try {
      const employeeData = await Employee.findOne({
        where: { id: data.employee_id },
        include: [
          {
            model: Company
          }
        ]
      });
      let presenceDate = new Date();
      presenceDate.setHours(presenceDate.getHours() + 7);
      presenceDate = dateConverter(presenceDate);
      // FIND SCHEDULE
      let todaySchedule = [];
      const scheduleTemplate = await scheduleTemplatesHelper(
        presenceDate,
        employeeData.id,
        employeeData.company_id,
        true
      );
      const definedSchedule = await definedSchedulesHelper(
        presenceDate,
        employeeData.company_id,
        employeeData.id
      );
      todaySchedule = scheduleTemplate.concat(definedSchedule);

      const { hourDeviation } = scheduleOrder(todaySchedule);
      presenceDate = new Date();
      presenceDate.setHours(presenceDate.getHours() + 7 - hourDeviation);
      presenceDate = dateConverter(presenceDate);

      const presences = await Presence.findAll({
        where: {
          employee_id: employeeData.id,
          presence_date: presenceDate
        }
      });
      if (presences.length) {
        presences.forEach(val => {
          if (!val.presence_start || !val.presence_end) {
            Object.assign(presenceProcess, {
              presenceStart: val.presence_start,
              presenceEnd: val.presence_end,
              restStart: val.rest_start,
              resEnd: val.rest_end
            });
            presenceComplete = false;
          }
        });
        if (presences.length >= todaySchedule.length && presenceComplete) {
          cb(new Error('Anda sudah melakukan presensi hari ini'));
          return true;
        }
      }

      if (!presenceProcess.presenceStart && !presenceProcess.presenceEnd && !presenceComplete) {
        cb(new Error('Atasan anda telah membuatkan presensi manual untuk anda hari ini'));
        return true;
      }

      if (!todaySchedule.length && presences.length) {
        Object.assign(presenceProcess, {
          presenceStart: presences[0].presence_start,
          presenceEnd: presences[0].presence_end,
          restStart: presences[0].rest_start,
          restEnd: presences[0].rest_end
        });
      }
      if (data.type === 'checkin' && presenceProcess.presenceStart && !presenceComplete) {
        cb(new Error('Anda sudah melakukan check-in sebelumnya'));
        return true;
      } else if (data.type === 'checkout' && !presenceProcess.presenceStart) {
        cb(new Error('Mohon lakukan check-in terlebih dahulu'));
        return true;
      } else if (data.type === 'rest_end' && !presenceProcess.restStart && !presenceComplete) {
        cb(new Error('Anda belum melakukan istirahat'));
        return true;
      } else if (data.type === 'rest_start' && presenceProcess.restStart && !presenceComplete) {
        cb(new Error('Anda sudah istirahat hari ini'));
        return true;
      } else if (data.type === 'rest_end' && presenceProcess.restEnd && !presenceComplete) {
        cb(new Error('Anda sudah selesai istirahat hari ini'));
        return true;
      }
      cb(null);
    } catch (error) {
      if (error.errors) {
        cb(error.errors);
        return true;
      }
      cb(error.message);
    }
  },
  checklog: async (req, res) => {
    const { data } = req.body;
    let presenceProcess;
    let schedules = [];
    const thisDate = new Date();
    let presenceDate = new Date();
    presenceDate.setHours(presenceDate.getHours() + 7);
    presenceDate = dateConverter(presenceDate);
    try {
      const employeeData = await Employee.findOne({
        where: { id: data.employee_id },
        include: [
          {
            model: Company,
            include: [{ model: CompanySetting, as: 'setting' }]
          },
          {
            model: SalaryGroup,
            through: { attributes: ['id'] }
          }
        ]
      });
      const owners = await Employee.findAll({
        where: {
          company_id: data.company_id,
          role: '1'
        },
        include: [
          {
            model: User,
            where: { demo_mode: 1, demo_step: 4 },
            attributes: ['demo_mode', 'demo_step']
          }
        ]
      });
      const scheduleTemplates = await scheduleTemplatesHelper(
        presenceDate,
        employeeData.id,
        employeeData.company_id,
        true
      );
      const definedSchedules = await definedSchedulesHelper(
        presenceDate,
        employeeData.company_id,
        employeeData.id
      );
      schedules = scheduleTemplates.concat(definedSchedules);
      const { hourDeviation, extendedSchedule } = scheduleOrder(schedules);
      presenceDate = new Date();
      presenceDate.setHours(presenceDate.getHours() + 7 - hourDeviation);
      const createdAt = new Date(`${presenceDate} +0700`);
      presenceDate = dateConverter(presenceDate);
      // Check Existing Complete Presence
      const presenceExist = await Presence.findAll({
        where: {
          employee_id: data.employee_id,
          presence_date: presenceDate,
          presence_start: { [Op.ne]: null },
          presence_end: { [Op.ne]: null }
        }
      });

      // Generate All Date in a month based on payroll date
      const rangedDate = dateProcessor.getRangedDate(employeeData.company.setting.payroll_date);

      // Find Source of Salary Group ID and Salary
      let salaryId = null;
      let salary = 0;
      let journalPayload = [];
      if (employeeData.salary_groups.length) {
        salaryId = employeeData.salary_groups[0].id;
        // Monthly
        if (employeeData.salary_groups[0].salary_type === '1') {
          let workdays;
          // IF MEMBER HAVE DAILY FREQUENT ON THEIR SALARY GROUP <-> V2.1
          if (employeeData.salary_groups[0].daily_frequent) {
            const dailyFrequent = employeeData.salary_groups[0].daily_frequent;
            workdays = countWorkdays(dailyFrequent, rangedDate.dateStart, rangedDate.dateEnd);
          } else {
            // IF MEMBER DOESNT HAVE DAILY FREQUENT ON THEIR SALARY GROUP, COUNT WORKDAYS BASED ON SCHEDULE INSTEAD <-> V2.1
            workdays = await countTotalSchedule(
              employeeData.id,
              rangedDate.dateStart,
              rangedDate.dateEnd
            );
          }
          if (workdays) {
            salary = employeeData.salary_groups[0].salary / workdays;
          }
        }
        // Shift
        if (
          employeeData.salary_groups[0].salary_type === '2' &&
          extendedSchedule.length &&
          extendedSchedule[0].shift
        ) {
          // USE SALARY FROM 3.0
          if (extendedSchedule[0].shift.schedule_shift.salary_group) {
            salary = extendedSchedule[0].shift.schedule_shift.salary_group.salary;
            // USE SALARY THAT STORED AT SHIFT <-> V2.1
          } else if (extendedSchedule[0].shift.schedule_shift.salary) {
            salary = extendedSchedule[0].shift.schedule_shift.salary;
            // USE SALARY THAT STORED AT SALARY GROUP, THEN MULTIPLY IT <-> V2.0
          } else if (extendedSchedule[0].shift.schedule_shift.shift_multiply) {
            salary =
              employeeData.salary_groups[0].salary *
              parseInt(extendedSchedule[0].shift.schedule_shift.shift_multiply);
          }
        }
      } else if (extendedSchedule.length && extendedSchedule[0].shift.schedule_shift.salary_group) {
        salaryId = extendedSchedule[0].shift.schedule_shift.salary_group.id;
        salary = extendedSchedule[0].shift.schedule_shift.salary_group.salary;
      }
      // Count Total Daily Allowance and Insert Journal Payload
      if (salaryId && !presenceExist.length) {
        const allowances = await Allowance.findAll({
          where: { salary_groups_id: salaryId, type: 1 },
          attributes: ['id', 'amount', 'name']
        });
        journalPayload.push({
          employee_id: employeeData.id,
          type: 'salary',
          salary_groups_id: salaryId,
          debet: parseInt(salary),
          description: `Gaji tanggal ${presenceDate}`,
          include_lunch_allowance: 1,
          include_transport_allowance: 1,
          on_hold: data.company_id === 0,
          created_at: createdAt
        });
        if (allowances.length) {
          for (const allowance of allowances) {
            journalPayload.push({
              employee_id: employeeData.id,
              type: 'allowance',
              salary_groups_id: null,
              allowance_id: allowance.id,
              debet: allowance.amount,
              description: `Tunjangan ${allowance.name} tanggal ${presenceDate}`,
              include_lunch_allowance: 0,
              include_transport_allowance: 0,
              on_hold: data.company_id === 0,
              created_at: createdAt
            });
          }
        }
      }

      if (data.type.toString() === 'checkin') {
        let presence_overdue = 0;
        // Checking presences overdue
        if (extendedSchedule.length) {
          if (!extendedSchedule[0].shift) {
            presence_overdue = await presenceOverdueCheckV1(
              new Date(`${thisDate} -0700`),
              employeeData.id
            );
          } else {
            const today = Moment(new Date()).tz(employeeData.company.timezone)._d;
            const scheduleStartTime = new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate(),
              extendedSchedule[0].shift.schedule_shift.start_time.split(':')[0],
              extendedSchedule[0].shift.schedule_shift.start_time.split(':')[1]
            );
            presence_overdue = Math.floor((today - scheduleStartTime) / (1000 * 60));
          }
        }

        let payload = {
          company_id: data.company_id || null,
          employee_id: employeeData.id,
          presence_date: presenceDate,
          presence_start: thisDate,
          checkin_location: employeeData.company.location,
          custom_presence: data.company_id === 0,
          is_custom_presence: data.company_id === 0
        };
        if (
          parseInt(presence_overdue) > parseInt(employeeData.company.setting.presence_overdue_limit)
        ) {
          // Insert presence overdue if beyond threshold
          payload.presence_overdue =
            presence_overdue - employeeData.company.setting.presence_overdue_limit;
          // Send late notification
          observe.emit(EVENT.MEMBER_LATE_PRESENCE, {
            userId: employeeData.user_id,
            companyId: employeeData.company.id,
            presenceDate,
            presenceOverdue: payload.presence_overdue
          });
          // Add Penalty
          if (
            employeeData.company.setting.late_deduction &&
            presence_overdue &&
            extendedSchedule.length
          ) {
            const deductionAmount =
              employeeData.company.setting.late_deduction * parseInt(presence_overdue);
            const journalPenalty = {
              employee_id: employeeData.id,
              type: 'other',
              kredit: deductionAmount,
              description: `Denda terlambat tanggal ${presenceDate}`,
              on_hold: data.company_id === 0,
              created_at: createdAt
            };
            const penaltyNote = {
              employee_id: employeeData.id,
              type: 2,
              date: dateConverter(createdAt),
              notes: `Denda terlambat masuk kerja tanggal ${presenceDate}`,
              amount: deductionAmount
            };
            await Journal.create(journalPenalty);
            await EmployeeNote.create(penaltyNote);
          }
        }
        // Insert the presence data
        presenceProcess = await Presence.create(payload);

        if (employeeData.salary_type === 1 && journalPayload.length) {
          await Journal.bulkCreate(journalPayload);
        }

        const responses = {
          uploadable_id: presenceProcess.id,
          type: data.type
        };

        return res
          .status(201)
          .json(response(true, 'Anda berhasil melakukan ceklok masuk', responses));
      } else if (data.type.toString() === 'checkout') {
        presenceProcess = await Presence.findOne({
          where: {
            employee_id: employeeData.id,
            presence_date: presenceDate,
            presence_start: { [Op.ne]: null },
            presence_end: null
          }
        });

        let restHours = 0;
        let totalHomeEarlyTime = 0;
        let overworkDuration = 0;
        if (presenceProcess.rest_end && presenceProcess.rest_start) {
          restHours =
            Math.abs(new Date(presenceProcess.rest_end) - new Date(presenceProcess.rest_start)) /
            36e5;
        }
        const checkining = new Date(presenceProcess.presence_start);
        const work_hours = Math.abs(checkining - new Date(`${thisDate} -0700`)) / 36e5;
        if (extendedSchedule.length) {
          const today = Moment(new Date()).tz(employeeData.company.timezone)._d;
          const scheduleEndTime = new Date(
            `${dateConverter(today)} ${
              extendedSchedule[0].shift
                ? extendedSchedule[0].shift.schedule_shift.end_time
                : extendedSchedule[0].end_time || extendedSchedule[0].presence_end
            }`
          );
          overworkDuration = Math.floor(today - scheduleEndTime) / (1000 * 60);
          overworkDuration = overworkDuration - employeeData.company.setting.overwork_limit;
        }
        const overwork = overworkDuration < 0 ? 0 : overworkDuration / 60;
        // Add Home Early Penalty
        if (extendedSchedule.length) {
          const today = Moment(new Date()).tz(employeeData.company.timezone)._d;
          const scheduleEndTime = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            extendedSchedule[0].shift.schedule_shift.end_time.split(':')[0],
            extendedSchedule[0].shift.schedule_shift.end_time.split(':')[1]
          );
          totalHomeEarlyTime = Math.floor((scheduleEndTime - today) / (1000 * 60));
          if (totalHomeEarlyTime > 0 && employeeData.company.setting.home_early_deduction) {
            const deductionAmount =
              totalHomeEarlyTime * employeeData.company.setting.home_early_deduction;
            const journalPenalty = {
              employee_id: employeeData.id,
              type: 'other',
              kredit: deductionAmount,
              description: `Denda pulang lebih awal tanggal ${presenceDate}`,
              on_hold: data.company_id === 0,
              created_at: createdAt
            };
            await Journal.create(journalPenalty);
          }
        }

        const updatePresence = await Presence.update(
          {
            presence_end: thisDate,
            checkout_location: employeeData.company.location,
            overwork,
            work_hours: (work_hours - restHours).toFixed(2),
            home_early: totalHomeEarlyTime >= 0 ? totalHomeEarlyTime : 0
          },
          {
            where: {
              id: presenceProcess.id
            }
          }
        );

        if (!updatePresence)
          return res.status(400).json(response(false, 'Gagal mengupdate presensi'));

        if (employeeData.salary_type === 0 && journalPayload.length) {
          await Journal.bulkCreate(journalPayload);
        }

        if (overwork !== 0) {
          observe.emit(EVENT.MEMBER_OVERWORK, {
            userId: employeeData.user_id,
            companyId: employeeData.company.id,
            presenceDate,
            overwork
          });
        }
        if (owners.length > 0) {
          const eventPayload = [];
          for (let i = 0; i < owners.length; i++) {
            eventPayload.push(owners[i].dataValues);
          }
          observe.emit(EVENT.WALKTROUGH_CHECKOUT, eventPayload);
        }
        const responses = {
          uploadable_id: presenceProcess.id,
          type: data.type
        };
        return res
          .status(201)
          .json(response(true, 'Anda berhasil melakukan ceklok pulang', responses));
      }
      return res.status(422).json(response(false, 'Wrong checklog type'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  rest: async (req, res) => {
    const { data } = req.body;
    let schedules = [];
    const thisDate = new Date();
    let presenceDate = new Date();
    presenceDate.setHours(presenceDate.getHours() + 7);
    presenceDate = dateConverter(presenceDate);
    try {
      const employee = await Employee.findOne({
        where: { id: data.employee_id },
        include: [
          {
            model: Company,
            include: [{ model: CompanySetting, as: 'setting' }]
          }
        ]
      });
      if (!employee) {
        return res.status(400).json(response(false, 'Failed to find employee data'));
      }

      const scheduleTemplates = await scheduleTemplatesHelper(
        presenceDate,
        employee.id,
        employee.company_id,
        true
      );
      const definedSchedules = await definedSchedulesHelper(
        presenceDate,
        employee.company_id,
        employee.id
      );
      schedules = scheduleTemplates.concat(definedSchedules);
      const { hourDeviation } = scheduleOrder(schedules);
      presenceDate = new Date();
      presenceDate.setHours(presenceDate.getHours() + 7 - hourDeviation);
      presenceDate = dateConverter(presenceDate);

      let updatePresence;
      let presences = await Presence.findOne({
        where: {
          employee_id: employee.id,
          presence_date: presenceDate,
          [Op.or]: [{ presence_start: null }, { presence_end: null }]
        }
      });

      if (data.type === 'rest_start') {
        updatePresence = await Presence.update(
          { rest_start: thisDate, rest_begin_location: employee.company.location },
          {
            where: {
              id: presences.id
            }
          }
        );
        if (!updatePresence)
          return res.status(400).json(response(false, 'Gagal mengupdate presensi'));
      } else if (data.type === 'rest_end') {
        // For testing rest_end time purpose, uncomment below
        // Date.prototype.addMinutes = function(m) {
        //     this.setMinutes(this.getMinutes() + m * 60000);
        //     return this;
        // };
        const started = new Date(`${presences.rest_start}+0700`);
        const totalRest = Math.floor(Math.abs(thisDate - started) / (1000 * 60)); // minutes
        const restOverdue = Math.floor(totalRest - employee.company.setting.rest_limit);
        const rest_overdue = restOverdue < 0 ? 0 : restOverdue;
        updatePresence = await Presence.update(
          { rest_end: thisDate, rest_overdue, rest_over_location: employee.company.location },
          {
            where: {
              id: presences.id
            }
          }
        );
        if (!updatePresence)
          return res.status(400).json(response(false, 'Gagal mengupdate presensi'));
      }
      const responses = {
        uploadable_id: presences.id,
        type: data.type
      };

      return res
        .status(201)
        .json(
          response(
            true,
            `Anda berhasil melakukan ${
              data.type === 'rest_start' ? 'mulai istirahat' : 'selesai istirahat'
            }`,
            responses
          )
        );
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = presenceService;

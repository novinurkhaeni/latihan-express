require('module-alias/register');
const Sequelize = require('sequelize');
const {
  response,
  scheduleTemplates: scheduleTemplatesHelper,
  definedSchedules: definedSchedulesHelper,
  dateProcessor,
  compareCoordinates,
  countTotalSchedule,
  presenceOverdueCheck: presenceOverdueCheckV1,
  countWorkdays,
  formatCurrency,
  scheduleOrder,
  dateConverter
} = require('@helpers');
const {
  employees: Employee,
  companies: Company,
  company_settings: CompanySetting,
  presences: Presence,
  journals: Journals,
  salary_groups: SalaryGroups,
  allowance: Allowance,
  employee_notes: EmployeeNote
} = require('@models');
const { Op } = Sequelize;
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const checklog = {
  checklogValidation: async (req, res, cb) => {
    const { employeeId } = res.local.users;
    const { company_id: companyId } = req.body;
    let presenceProcess = {
      presenceStart: null,
      presenceEnd: null,
      restStart: null,
      resEnd: null
    };
    let presenceComplete = true;
    let companyIds = [];
    let timeDeviation = 0;
    try {
      const employeeData = await Employee.findOne({
        where: { id: employeeId },
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
      // ONLY CHECK CEKLOK LOCATION IF COMPANY ID !== 0. COMPANY ID 0 MEANS CUSTOM CEKLOK LOCATION
      if (companyId) {
        // Employee Default Company Branch Location
        companyIds.push({
          companyId: employeeData.company.id,
          location: employeeData.company.location
        });

        const { todaySchedule: eligibleCompanyBranch, hourDeviation } = scheduleOrder(
          todaySchedule
        );
        timeDeviation = hourDeviation;
        if (todaySchedule.length && todaySchedule[0].company) {
          if (eligibleCompanyBranch.length)
            companyIds.push({
              companyId: eligibleCompanyBranch[0].company.id,
              location: eligibleCompanyBranch[0].company.location
            });
        }

        const checkBranch = companyIds.find(val => val.companyId === parseInt(companyId));

        if (!checkBranch) {
          cb(new Error('Anda tidak bisa melakukan checklog di lokasi terpilih'));
          return true;
        }
        const presencesLocation = req.body.location.replace(/\s/g, '').split(',');
        const companyLocation = await checkBranch.location.replace(/\s/g, '').split(',');
        const radius = compareCoordinates(
          presencesLocation[0],
          presencesLocation[1],
          companyLocation[0],
          companyLocation[1]
        );

        if (parseFloat(radius) >= 505) {
          cb(new Error('Presensi anda tidak di tempat yang sesuai dengan kantor'));
          return true;
        }
      }

      presenceDate = new Date();
      presenceDate.setHours(presenceDate.getHours() + 7 - timeDeviation);
      presenceDate = dateConverter(presenceDate);

      const presences = await Presence.findAll({
        where: {
          employee_id: employeeData.id,
          presence_date: presenceDate
        }
      });
      if (todaySchedule.length) {
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
          cb(new Error('Anda sudah melakukan check-in sebelumnya'));
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

      if (req.body.type.toString() === 'checkin') {
        if (presenceProcess.presenceStart) {
          cb(new Error('Anda sudah melakukan check-in sebelumnya'));
          return true;
        }
      } else if (req.body.type.toString() === 'checkout') {
        if (!presenceProcess.presenceStart) {
          cb(new Error('Mohon lakukan check-in terlebih dahulu'));
          return true;
        }
      } else if (req.body.type.toString() === 'rest_start') {
        if (presenceProcess.restStart) {
          cb(new Error('Anda sudah istirahat hari ini'));
          return true;
        }
      } else if (req.body.type.toString() === 'rest_end') {
        if (presenceProcess.restEnd) {
          cb(new Error('Anda sudah selesai istirahat hari ini'));
          return true;
        }
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

  checklog: async (req, res, checkLocation = true) => {
    const { employeeId, id: userId } = res.local.users;
    const { company_id: companyId } = req.body;
    let presenceProcess;
    let schedules = [];
    const thisDate = new Date();
    let presenceDate = new Date();
    presenceDate.setHours(presenceDate.getHours() + 7);
    presenceDate = dateConverter(presenceDate);
    try {
      const employeeData = await Employee.findOne({
        where: { id: employeeId },
        include: [
          {
            model: Company,
            include: [{ model: CompanySetting, as: 'setting' }]
          },
          {
            model: SalaryGroups,
            through: { attributes: ['id'] }
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
      const { hourDeviation, extendedSchedule: todaySchedule } = scheduleOrder(schedules);
      presenceDate = new Date();
      presenceDate.setHours(presenceDate.getHours() + 7 - hourDeviation);
      const createdAt = new Date(`${presenceDate} +0700`);
      presenceDate = dateConverter(presenceDate);
      // Check Existing Complete Presence
      const presenceExist = await Presence.findAll({
        where: {
          employee_id: employeeId,
          presence_date: presenceDate,
          presence_start: { [Op.ne]: null },
          presence_end: { [Op.ne]: null }
        }
      });

      if (employeeData.salary_groups.length) {
        const allowances = await Allowance.findAll({
          where: { salary_groups_id: employeeData.salary_groups[0].id, type: 1 },
          attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'amount']]
        });
        employeeData.salary_groups[0].dataValues.allowances = allowances;
      }
      // Generate All Date in a month based on payroll date
      const rangedDate = dateProcessor.getRangedDate(employeeData.company.setting.payroll_date);
      // Compose Journal Payload
      let journalPayload;
      if (!employeeData.salary_groups.length && !presenceExist.length) {
        journalPayload = {
          employee_id: employeeData.id,
          type: 'salary',
          debet: employeeData.daily_salary_with_meal || employeeData.daily_salary || 0,
          description: `Gaji tanggal ${presenceDate}`,
          on_hold: companyId === 0,
          created_at: createdAt
        };
      } else if (employeeData.salary_groups.length && !presenceExist.length) {
        let dailySalary;
        let allowance;
        // IF MEMBER HAS NEWEST ALLOWANCE DATA FROM V2.1
        if (employeeData.salary_groups[0].dataValues.allowances[0].amount) {
          allowance = employeeData.salary_groups[0].dataValues.allowances[0].amount;
        } else {
          // IF MEMBER HAS OLD ALLOWANCE DATA FROM V2.0
          allowance =
            employeeData.salary_groups[0].transport_allowance +
            employeeData.salary_groups[0].lunch_allowance;
        }
        // salary type = 1 indicates that salary calculation will be based on total schedule in current month
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
            dailySalary = employeeData.salary_groups[0].salary / workdays + parseInt(allowance);
            journalPayload = {
              employee_id: employeeData.id,
              type: 'salary',
              debet: dailySalary,
              description: `Gaji tanggal ${presenceDate}`,
              include_lunch_allowance: 1,
              include_transport_allowance: 1,
              on_hold: companyId === 0,
              created_at: createdAt
            };
          }
          // salary type = 2 indicates that salary calculation will be based on shift multiplier
        } else if (employeeData.salary_groups[0].salary_type === '2') {
          if (todaySchedule.length) {
            // EMPLOYEES HAVE SHIFT ON THEIR SCHEDULE
            if (todaySchedule[0].shift) {
              // USE SALARY THAT STORED AT SHIFT <-> V2.1
              if (todaySchedule[0].shift.schedule_shift.salary) {
                dailySalary = todaySchedule[0].shift.schedule_shift.salary;
              }
              if (
                !todaySchedule[0].shift.schedule_shift.salary &&
                todaySchedule[0].shift.schedule_shift.shift_multiply
              ) {
                // USE SALARY THAT STORED AT SALARY GROUP, THEN MULTIPLY IT <-> V2.0
                dailySalary =
                  employeeData.salary_groups[0].salary *
                  parseInt(todaySchedule[0].shift.schedule_shift.shift_multiply);
              }
              dailySalary = dailySalary + parseInt(allowance);
            } else {
              // EMPLOYEES DOESNT HAVE SHIFT ON THEIR SCHEDULE
              dailySalary = employeeData.daily_salary_with_meal || employeeData.daily_salary;
            }
            journalPayload = {
              employee_id: employeeData.id,
              type: 'salary',
              debet: dailySalary,
              description: `Gaji tanggal ${presenceDate}`,
              include_lunch_allowance: 1,
              include_transport_allowance: 1,
              on_hold: companyId === 0,
              created_at: createdAt
            };
          }
        }
      }

      if (req.body.type.toString() === 'checkin') {
        let presence_overdue = 0;
        // Checking presences overdue
        if (todaySchedule.length) {
          if (!todaySchedule[0].shift) {
            presence_overdue = await presenceOverdueCheckV1(
              new Date(`${thisDate} -0700`),
              employeeData.id
            );
          } else {
            const today = new Date();
            today.setHours(today.getHours() + 7);
            const scheduleStartTime = new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate(),
              todaySchedule[0].shift.schedule_shift.start_time.split(':')[0],
              todaySchedule[0].shift.schedule_shift.start_time.split(':')[1]
            );
            presence_overdue = Math.floor((today - scheduleStartTime) / (1000 * 60));
          }
        }

        let payload = {
          company_id: companyId || null,
          employee_id: employeeData.id,
          presence_date: presenceDate,
          presence_start: thisDate,
          checkin_location: checkLocation ? req.body.location : null,
          custom_presence: companyId === 0
        };
        if (
          parseInt(presence_overdue) > parseInt(employeeData.company.setting.presence_overdue_limit)
        ) {
          // Insert presence overdue if beyond threshold
          payload.presence_overdue =
            presence_overdue - employeeData.company.setting.presence_overdue_limit;
          // Send late notification
          observe.emit(EVENT.MEMBER_LATE_PRESENCE, {
            userId,
            companyId: employeeData.company.id,
            presenceDate,
            presenceOverdue: presence_overdue
          });
          // Add Penalty
          if (
            employeeData.company.setting.late_deduction &&
            presence_overdue &&
            todaySchedule.length
          ) {
            const deductionAmount =
              employeeData.company.setting.late_deduction * parseInt(presence_overdue);
            const journalPenalty = {
              employee_id: employeeData.id,
              type: 'other',
              kredit: deductionAmount,
              description: `Denda terlambat tanggal ${presenceDate}`,
              on_hold: companyId === 0,
              created_at: createdAt
            };
            const employeeNote = {
              employee_id: employeeData.id,
              type: 2,
              date: presenceDate,
              notes: `Potongan terlambat selama ${presence_overdue} menit sebesar Rp.${formatCurrency(
                deductionAmount
              )}`
            };
            await Journals.create(journalPenalty);
            await EmployeeNote.create(employeeNote);
          }
        }

        // Insert the presence data
        presenceProcess = await Presence.create(payload);

        if (employeeData.salary_type === 1 && journalPayload && employeeData.salary_groups.length) {
          await Journals.create(journalPayload);
        }

        const responses = {
          uploadable_id: presenceProcess.id,
          type: req.body.type
        };

        return res.status(201).json(response(true, 'Anda berhasil melakukan check-in', responses));
      } else if (req.body.type.toString() === 'checkout') {
        presenceProcess = await Presence.findOne({
          where: {
            employee_id: employeeData.id,
            presence_date: presenceDate,
            [Op.or]: [{ presence_start: null }, { presence_end: null }]
          }
        });

        let restHours = 0;
        let totalHomeEarlyTime = 0;
        if (presenceProcess.rest_end && presenceProcess.rest_start) {
          restHours =
            Math.abs(new Date(presenceProcess.rest_end) - new Date(presenceProcess.rest_start)) /
            36e5;
        }
        const checkining = new Date(presenceProcess.presence_start);
        const work_hours = Math.abs(checkining - new Date(`${thisDate} -0700`)) / 36e5;
        const overWorked = Math.floor(
          work_hours - restHours - employeeData.company.setting.overwork_limit
        );
        const overwork = overWorked < 0 ? 0 : overWorked;
        // Add Home Early Penalty
        if (todaySchedule.length && employeeData.company.setting.home_early_deduction) {
          const today = new Date();
          today.setHours(today.getHours() + 7);
          const scheduleEndTime = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            todaySchedule[0].shift.schedule_shift.end_time.split(':')[0],
            todaySchedule[0].shift.schedule_shift.end_time.split(':')[1]
          );
          totalHomeEarlyTime = Math.floor((scheduleEndTime - today) / (1000 * 60));
          if (totalHomeEarlyTime > 0) {
            const deductionAmount =
              totalHomeEarlyTime * employeeData.company.setting.home_early_deduction;
            const journalPenalty = {
              employee_id: employeeData.id,
              type: 'other',
              kredit: deductionAmount,
              description: `Denda pulang lebih awal tanggal ${presenceDate}`,
              on_hold: companyId === 0,
              created_at: createdAt
            };
            const employeeNote = {
              employee_id: employeeData.id,
              type: 2,
              date: presenceDate,
              notes: `Potongan pulang lebih awal selama ${totalHomeEarlyTime} menit sebesar Rp.${formatCurrency(
                deductionAmount
              )}`
            };
            await Journals.create(journalPenalty);
            await EmployeeNote.create(employeeNote);
          }
        }

        const updatePresence = await Presence.update(
          {
            presence_end: thisDate,
            checkout_location: checkLocation ? req.body.location : null,
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

        if (!employeeData.salary_groups.length) {
          await Journals.create(journalPayload);
        }
        if (employeeData.salary_type === 0 && journalPayload && employeeData.salary_groups.length) {
          await Journals.create(journalPayload);
        }

        if (overwork !== 0) {
          observe.emit(EVENT.MEMBER_OVERWORK, {
            userId,
            companyId: employeeData.company.id,
            presenceDate,
            overwork
          });
        }
        const responses = {
          uploadable_id: presenceProcess.id,
          type: req.body.type
        };
        return res.status(201).json(response(true, 'Anda berhasil melakukan checkout', responses));
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
    const { type } = req.body;
    const { employeeId } = res.local.users;
    let schedules = [];
    const thisDate = new Date();
    let presenceDate = new Date();
    presenceDate.setHours(presenceDate.getHours() + 7);
    presenceDate = dateConverter(presenceDate);

    try {
      const employee = await Employee.findOne({
        where: { id: employeeId },
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

      if (type.toString() === 'rest_start') {
        updatePresence = await Presence.update(
          { rest_start: thisDate, rest_begin_location: req.body.location },
          {
            where: {
              id: presences.id
            }
          }
        );
        if (!updatePresence)
          return res.status(400).json(response(false, 'Gagal mengupdate presensi'));
      } else if (type.toString() === 'rest_end') {
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
          { rest_end: thisDate, rest_overdue, rest_over_location: req.body.location },
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
        type: req.body.type
      };

      return res
        .status(201)
        .json(
          response(
            true,
            `Berhasil melakukan ${type.toString() === 'rest_start' ? 'istirahat' : 'kembali'}`,
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

module.exports = checklog;

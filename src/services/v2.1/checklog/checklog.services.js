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
  countWorkdays
} = require('@helpers');
const { presenceOverdueCheck: presenceOverdueCheckV2 } = require('@helpers/v2');
const {
  employees: Employee,
  companies: Company,
  company_settings: CompanySetting,
  presences: Presence,
  journals: Journals,
  salary_groups: SalaryGroups,
  digital_assets: DigitalAsset,
  allowance: Allowance
} = require('@models');
const { Op } = Sequelize;
// const { presenceService } = require('@services/v1');
const path = require('path');
const config = require('config');
const fs = require('fs');
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const checklog = {
  checklogValidation: async (req, res) => {
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
    try {
      const employeeData = await Employee.findOne({
        where: { id: employeeId },
        include: [
          {
            model: Company
          }
        ]
      });
      companyIds.push({
        companyId: employeeData.company.id,
        location: employeeData.company.location
      });
      let presenceDate = new Date();
      presenceDate.setHours(presenceDate.getHours() + 7);
      presenceDate = `${presenceDate.getFullYear()}-${('0' + (presenceDate.getMonth() + 1)).slice(
        -2
      )}-${('0' + presenceDate.getDate()).slice(-2)}`;

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
      if (todaySchedule.length && todaySchedule[0].company)
        companyIds.push({
          companyId: todaySchedule[0].company.id,
          location: todaySchedule[0].company.location
        });

      const checkBranch = companyIds.find(val => val.companyId === parseInt(companyId));

      if (!checkBranch) return 'Anda tidak bisa melakukan checklog di lokasi terpilih';

      const presencesLocation = req.body.location.replace(/\s/g, '').split(',');
      const companyLocation = await checkBranch.location.replace(/\s/g, '').split(',');
      const radius = compareCoordinates(
        presencesLocation[0],
        presencesLocation[1],
        companyLocation[0],
        companyLocation[1]
      );

      if (parseFloat(radius) >= 505) {
        return 'Presensi anda tidak di tempat yang sesuai dengan kantor';
      }

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

        if (presences.length >= todaySchedule.length && presenceComplete)
          return 'Anda sudah tidak bisa ceklok lagi hari ini';
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
          return 'Anda sudah melakukan check-in sebelumnya';
        }

        return true;
      } else if (req.body.type.toString() === 'checkout') {
        if (!presenceProcess.presenceStart) {
          return 'Mohon lakukan check-in terlebih dahulu';
        }

        return true;
      } else if (req.body.type.toString() === 'rest_start') {
        if (presenceProcess.restStart) {
          return 'Anda sudah istirahat hari ini';
        }

        return true;
      } else if (req.body.type.toString() === 'rest_end') {
        if (presenceProcess.restEnd) {
          return 'Anda sudah selesai istirahat hari ini';
        }

        return true;
      }
    } catch (error) {
      if (error.errors) {
        return error.errors;
      }
      return error.message;
    }
  },

  checklog: async (req, res, checkLocation = true) => {
    const { employeeId, id: userId } = res.local.users;
    const { company_id: companyId } = req.body;
    const host =
      process.env.NODE_ENV !== 'production'
        ? `http://${config.host}:${config.port}/`
        : `https://${config.host}/`;

    let filepath;
    let presenceProcess;
    let payloadDigital = {
      type: req.body.type,
      uploadable_type: 'presences'
    };
    const thisDate = new Date();
    let presenceDate = new Date();
    presenceDate.setHours(presenceDate.getHours() + 7);
    presenceDate = `${presenceDate.getFullYear()}-${('0' + (presenceDate.getMonth() + 1)).slice(
      -2
    )}-${('0' + presenceDate.getDate()).slice(-2)}`;
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
      if (employeeData.salary_groups.length) {
        const allowances = await Allowance.findAll({
          where: { salary_groups_id: employeeData.salary_groups[0].id },
          attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'amount']]
        });
        employeeData.salary_groups[0].dataValues.allowances = allowances;
      }

      let todaySchedule = await scheduleTemplatesHelper(
        presenceDate,
        employeeData.id,
        employeeData.company_id,
        true
      );
      if (!todaySchedule.length) {
        todaySchedule = await definedSchedulesHelper(
          presenceDate,
          employeeData.company_id,
          employeeData.id
        );
      }
      // Generate All Date in a month based on payroll date
      const rangedDate = dateProcessor.getRangedDate(employeeData.company.setting.payroll_date);
      // This will handle file as encoded base64 from client
      if (!req.file) {
        const base64Data = req.body.file.replace(/^data:image\/png;base64,/, '');
        const filename = Date.now() + '.png';

        filepath = path.join(__dirname + '/../../../public/uploads/' + filename);

        fs.writeFile(filepath, base64Data, 'base64', error => {
          if (error) {
            return new Error('Something went wrong when save your image! Please try again.');
          }
        });
        payloadDigital['filename'] = filename;
        payloadDigital['mime_type'] = 'image/png';
        payloadDigital['path'] = 'public/uploads/' + filename;
        payloadDigital['url'] = host + 'uploads/' + filename;
      }

      // This will handle file as blob from client
      if (req.file) {
        filepath = req.file.path.split('/')[1];

        payloadDigital['path'] = req.file.path;
        payloadDigital['filename'] = req.file.filename;
        payloadDigital['mime_type'] = req.file.mimetype;
        payloadDigital['url'] = `${host}${filepath}/${req.file.filename}`;
      }

      // Compose Journal Payload
      let journalPayload;
      if (!employeeData.salary_groups.length) {
        journalPayload = {
          employee_id: employeeData.id,
          type: 'salary',
          debet: employeeData.daily_salary_with_meal || employeeData.daily_salary,
          description: `Gaji tanggal ${presenceDate}`
        };
      } else {
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
              include_transport_allowance: 1
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
              include_transport_allowance: 1
            };
          }
        }
      }

      if (req.body.type.toString() === 'checkin') {
        let presence_overdue = 0;
        presenceProcess = await Presence.findOne({
          where: {
            employee_id: employeeData.id,
            presence_date: presenceDate
          }
        });
        if (presenceProcess) {
          return res.status(400).json(response(false, 'Anda sudah melakukan check-in sebelumnya'));
        }
        // Checking presences overdue
        if (todaySchedule.length) {
          if (!todaySchedule[0].shift) {
            presence_overdue = await presenceOverdueCheckV1(
              new Date(`${thisDate} -0700`),
              employeeData.id
            );
          } else {
            presence_overdue = await presenceOverdueCheckV2(
              new Date(`${thisDate} -0700`),
              employeeData.id
            );
          }
        }

        let payload = {
          company_id: companyId,
          employee_id: employeeData.id,
          presence_date: presenceDate,
          presence_start: thisDate,
          checkin_location: checkLocation ? req.body.location : null
        };
        if (
          parseInt(presence_overdue) > parseInt(employeeData.company.setting.presence_overdue_limit)
        ) {
          // Insert presence overdue if beyond threshold
          payload.presence_overdue =
            presence_overdue - employeeData.company.setting.presence_overdue_limit;
        }

        // Insert the presence data
        presenceProcess = await Presence.create(payload);

        // Insert digital assets data
        payloadDigital['uploadable_id'] = presenceProcess.id;
        await DigitalAsset.create(payloadDigital);

        if (
          parseInt(presence_overdue) > parseInt(employeeData.company.setting.notif_presence_overdue)
        ) {
          observe.emit(EVENT.MEMBER_LATE_PRESENCE, {
            userId,
            companyId: employeeData.company.id,
            presenceDate,
            presenceOverdue: presence_overdue
          });
        }
        if (employeeData.salary_type === 1 && journalPayload && employeeData.salary_groups.length) {
          await Journals.create(journalPayload);
        }
        return res.status(201).json(response(true, 'Anda berhasil melakukan check-in'));
      } else if (req.body.type.toString() === 'checkout') {
        presenceProcess = await Presence.findOne({
          where: {
            employee_id: employeeData.id,
            presence_date: presenceDate
          }
        });
        if (!presenceProcess) {
          return res.status(400).json(response(false, 'Mohon lakukan check-in terlebih dahulu'));
        }
        // Insert digital assets data
        payloadDigital['uploadable_id'] = presenceProcess.id;
        await DigitalAsset.create(payloadDigital);

        let restHours = 0;
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

        presenceProcess = await Presence.update(
          {
            presence_end: thisDate,
            checkout_location: checkLocation ? req.body.location : null,
            overwork,
            work_hours: (work_hours - restHours).toFixed(2)
          },
          {
            where: {
              employee_id: employeeData.id,
              presence_date: presenceDate
            }
          }
        );
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
        return res.status(201).json(response(true, 'Anda berhasil melakukan checkout'));
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
    const thisDate = new Date();
    let presenceDate = new Date();
    presenceDate.setHours(presenceDate.getHours() + 7);
    presenceDate = `${presenceDate.getFullYear()}-${('0' + (presenceDate.getMonth() + 1)).slice(
      -2
    )}-${presenceDate.getDate()}`;

    const host =
      process.env.NODE_ENV !== 'production'
        ? `http://${config.host}:${config.port}/`
        : `https://${config.host}/`;

    let filepath;
    let payloadDigital = {
      type: type,
      uploadable_type: 'presences'
    };

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
      let presences = await Presence.findOne({
        where: {
          employee_id: employee.id,
          presence_date: presenceDate,
          [Op.or]: [
            { presence_start: null },
            { presence_end: null },
            { rest_start: null },
            { rest_end: null }
          ]
        }
      });
      // This will handle file as encoded base64 from client
      if (!req.file) {
        const base64Data = req.body.file.replace(/^data:image\/png;base64,/, '');
        const filename = Date.now() + '.png';

        filepath = path.join(__dirname + '/../../../public/uploads/' + filename);

        fs.writeFile(filepath, base64Data, 'base64', error => {
          if (error) {
            return new Error('Something went wrong when save your image! Please try again.');
          }
        });
        payloadDigital['filename'] = filename;
        payloadDigital['mime_type'] = 'image/png';
        payloadDigital['path'] = 'public/uploads/' + filename;
        payloadDigital['url'] = host + 'uploads/' + filename;
      }

      // This will handle file as blob from client
      if (req.file) {
        filepath = req.file.path.split('/')[1];

        payloadDigital['path'] = req.file.path;
        payloadDigital['filename'] = req.file.filename;
        payloadDigital['mime_type'] = req.file.mimetype;
        payloadDigital['url'] = `${host}${filepath}/${req.file.filename}`;
      }

      if (type.toString() === 'rest_start') {
        // Insert digital assets data
        payloadDigital['uploadable_id'] = presences.id;
        await DigitalAsset.create(payloadDigital);

        presences = await Presence.update(
          { rest_start: thisDate },
          {
            where: {
              id: presences.id
            }
          }
        );
      } else if (type.toString() === 'rest_end') {
        // Insert digital assets data
        payloadDigital['uploadable_id'] = presences.id;
        await DigitalAsset.create(payloadDigital);

        // For testing rest_end time purpose, uncomment below
        // Date.prototype.addMinutes = function(m) {
        //     this.setMinutes(this.getMinutes() + m * 60000);
        //     return this;
        // };
        const started = new Date(`${presences.rest_start}+0700`);
        const totalRest = Math.floor(Math.abs(thisDate - started) / (1000 * 60)); // minutes
        const restOverdue = Math.floor(totalRest - employee.company.setting.rest_limit);
        const rest_overdue = restOverdue < 0 ? 0 : restOverdue;
        presences = await Presence.update(
          { rest_end: thisDate, rest_overdue },
          {
            where: {
              id: presences.id
            }
          }
        );
      }

      return res
        .status(201)
        .json(
          response(
            true,
            `Berhasil melakukan ${type.toString() === 'rest_start' ? 'istirahat' : 'kembali'}`
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

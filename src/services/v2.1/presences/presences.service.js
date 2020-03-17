require('module-alias/register');
const Sequelize = require('sequelize');
const {
  response,
  countTotalSchedule,
  scheduleTemplates: scheduleTemplatesHelpers,
  definedSchedules: definedSchedulesHelpers,
  dateProcessor,
  countWorkdays,
  formatCurrency,
  dateConverter
} = require('@helpers');
const { presenceOverdueCheck: presenceOverdueCheckV2 } = require('@helpers/v2');
const { presenceOverdueCheck: presenceOverdueCheckV1 } = require('@helpers');
const {
  employees: Employee,
  presences: Presence,
  employee_notes: EmployeeNote,
  journals: Journal,
  salary_groups: SalaryGroup,
  companies: Companies,
  company_settings: CompanySettings,
  users: User,
  allowance: Allowance,
  digital_assets: DigitalAsset,
  division_details: DivisionDetails,
  divisions: Divisions
} = require('@models');

const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const presenceService = {
  /**
   * Get Presence Detail
   */
  get: async (req, res) => {
    const { presence_id } = req.params;

    try {
      const presences = await Presence.findOne({
        where: { id: presence_id },
        include: [
          {
            model: DigitalAsset,
            required: false,
            attributes: ['url', 'type'],
            where: {
              type: ['checkin', 'checkout', 'rest_start', 'rest_end']
            },
            as: 'assets'
          },
          {
            model: Employee,
            include: [
              {
                model: User
              },
              {
                model: EmployeeNote,
                required: false,
                where: Sequelize.where(
                  Sequelize.fn('DATE_FORMAT', Sequelize.col('date'), '%Y%c%d'),
                  Sequelize.fn('DATE_FORMAT', Sequelize.col('presences.presence_date'), '%Y%c%d')
                )
              },
              {
                model: Journal,
                required: false,
                where: [
                  Sequelize.where(
                    Sequelize.fn(
                      'DATE_FORMAT',
                      Sequelize.col('employee->journals.created_at'),
                      '%Y%c%d'
                    ),
                    Sequelize.fn('DATE_FORMAT', Sequelize.col('presences.presence_date'), '%Y%c%d')
                  ),
                  { $not: { type: 'withdraw' } }
                ],
                attributes: ['type', 'debet', 'kredit', 'description', 'created_at']
              },
              {
                model: DigitalAsset,
                required: false,
                attributes: ['url', 'type'],
                where: {
                  type: 'avatar'
                },
                as: 'assets'
              },
              { model: DivisionDetails, include: { model: Divisions } }
            ]
          },
          { model: Companies, attributes: ['name', 'company_name'] }
        ]
      });
      let totalSalary = 0;
      let totalBonus = 0;
      let totalPenalty = 0;
      for (let i = 0; i < presences.employee.journals.length; i++) {
        if (presences.employee.journals[i].type.toString() === 'salary') {
          totalSalary += presences.employee.journals[i].debet;
        }
        if (
          presences.employee.journals[i].type.toString() === 'other' ||
          presences.employee.journals[i].type.toString() === 'periodic'
        ) {
          totalBonus += presences.employee.journals[i].debet;
          totalPenalty += presences.employee.journals[i].kredit;
        }
      }

      totalSalary = totalSalary + totalBonus - totalPenalty;

      let setOfNotes = [];

      const notes = presences.employee.employee_notes.filter(val => val.type === null);
      const bonusNote = presences.employee.employee_notes.filter(val => val.type === 1);
      const penaltyNote = presences.employee.employee_notes.filter(val => val.type === 2);

      presences.employee.employee_notes.forEach(val => setOfNotes.push(val.notes));

      setOfNotes = setOfNotes.toString().replace(/,/g, ', ');

      let result = Object.assign({
        id: presences.id,
        presence_date: presences.presence_date,
        presence_start: presences.presence_start,
        presence_end: presences.presence_end,
        rest_start: presences.rest_start,
        rest_end: presences.rest_end,
        presence_overdue: presences.presence_overdue,
        rest_overdue: presences.rest_overdue,
        is_absence: presences.is_absence,
        is_leave: presences.is_leave,
        is_holiday: presences.is_holiday,
        is_permit: presences.is_permit,
        overwork: presences.overwork,
        home_early: presences.home_early,
        work_hours: presences.work_hours,
        salary: totalSalary,
        bonus: totalBonus,
        penalty: totalPenalty,
        presence_assets: presences.assets,
        notes: notes.length ? notes[0].notes : null,
        notes_id: notes.length ? notes[0].id : null,
        set_of_notes: setOfNotes,
        bonus_note: bonusNote,
        penalty_note: penaltyNote,
        employee: {
          id: presences.employee.id,
          role: presences.employee.role,
          full_name: presences.employee.user.full_name,
          email: presences.employee.user.email,
          phone: presences.employee.user.phone,
          assets: presences.employee.assets,
          divisions: presences.employee.division_details
        },
        company: presences.company
      });
      if (!presences) {
        return res.status(400).json(response(false, `Presences with id ${presence_id} not found`));
      }
      return res.status(200).json(response(true, 'Presence detail retrieved successfully', result));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  /*
   * Create manual presence data
   *
   */
  create: async (req, res, isReturn = true) => {
    const { data } = req.body;
    const { company_id } = req.params;
    const { id, employeeId } = res.local.users;
    const presenceStart = req.query.type
      ? new Date(data.presence_start)
      : new Date(`${data.presence_start} +0700`);
    const presenceEnd = req.query.type
      ? new Date(data.presence_end)
      : new Date(`${data.presence_end} +0700`);
    const restStart = data.rest_start ? new Date(`${data.rest_start} +0700`) : null;
    const restEnd = data.rest_end ? new Date(`${data.rest_end} +0700`) : null;
    let presence;
    let notes;
    let bonusNote;
    let penaltyNote;
    let payloadArray = [];
    let payloadJournal = [];
    let payloadNotes = [];
    let payloadBonusNote = [];
    let payloadPenaltyNote = [];
    let salaryPerday = 0;
    let warningMessage = [];
    let warningShiftMessage = [];
    let memberNames = [];
    let responseMessage;
    let responsePayload = { showAlert: false };
    let presenceType = '';

    try {
      const memberArray = data.member;

      const companyData = await Companies.findOne({
        where: { id: company_id },
        include: { model: CompanySettings, as: 'setting' }
      });

      const employeeData = await Employee.findAll({
        where: { id: memberArray },
        include: [
          {
            model: SalaryGroup,
            through: { attributes: ['id'] }
          },
          { model: User, attributes: ['full_name'] }
        ]
      });
      for (let i = 0; i < employeeData.length; i++) {
        if (employeeData[i].salary_groups.length) {
          const allowances = await Allowance.findAll({
            where: { salary_groups_id: employeeData[i].salary_groups[0].id, type: 1 },
            attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'amount']]
          });
          employeeData[i].salary_groups[0].dataValues.allowances = allowances;
        }
      }

      const start = new Date(data.presence_start);
      const end = new Date(data.presence_end);
      let arrayDate = [];
      while (start <= end) {
        arrayDate.push(
          `${start.getFullYear()}-${('0' + (start.getMonth() + 1)).slice(-2)}-${(
            '0' + start.getDate()
          ).slice(-2)}`
        );
        start.setDate(start.getDate() + 1);
      }
      // VALIDATE
      presence = await Presence.findAll({
        where: {
          employee_id: memberArray,
          presence_date: {
            $gte: dateConverter(new Date(data.presence_start)),
            $lte: dateConverter(new Date(data.presence_end))
          }
        }
      });
      for (const date of arrayDate) {
        for (const member of memberArray) {
          const findPresence = presence.filter(val => val.presence_date === date);
          if (findPresence.length) {
            let checkSchedule = [];
            const company = employeeData.find(val => val.id === member);
            checkSchedule = await scheduleTemplatesHelpers(date, member, company.company_id, true);
            const definedSchedule = await definedSchedulesHelpers(date, company.company_id, member);
            checkSchedule = checkSchedule.concat(definedSchedule);
            if (findPresence.length >= checkSchedule.length) {
              if (isReturn === true) {
                return res
                  .status(400)
                  .json(response(false, 'Anggota terpilih ada yang sudah melakukan presensi'));
              }

              return {
                status: false,
                message: 'Anggota terpilih ada yang sudah melakukan presensi'
              };
            }
          }
        }
      }

      for (let s = 0; s < arrayDate.length; s++) {
        for (let i = 0; i < memberArray.length; i++) {
          const newDate = new Date(arrayDate[s]);
          const presenceStarted = presenceStart.setFullYear(
            newDate.getFullYear(),
            newDate.getMonth(),
            newDate.getDate()
          );
          const presenceEnded = presenceEnd.setFullYear(
            newDate.getFullYear(),
            newDate.getMonth(),
            newDate.getDate()
          );
          const restStarted =
            restStart &&
            restStart.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
          const restEnded =
            restEnd &&
            restEnd.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
          payloadArray.push({
            employee_id: memberArray[i],
            company_id: data.company_id,
            presence_date: arrayDate[s],
            presence_start: new Date(presenceStarted),
            presence_end: new Date(presenceEnded),
            rest_start: restStart && new Date(restStarted),
            rest_end: restEnd && new Date(restEnded),
            submission_id: data.submission_id || null
          });
        }
      }
      // COLLECT MEMBERS NAME
      for (const data of payloadArray) {
        const employee = employeeData.find(value => value.id === data.employee_id);
        memberNames.push(employee.user.full_name);
      }
      memberNames = memberNames.toString().replace(/,/g, ', ');
      /*
       *  IF type of presense is cuti, izin, libur atau tidak masuk
       */
      if (req.query.type) {
        if (
          req.query.type === 'leave' ||
          req.query.type === 'holiday' ||
          req.query.type === 'permit'
        ) {
          for (let i = 0; i < payloadArray.length; i++) {
            let salaryMember = employeeData.find(data => data.id === payloadArray[i].employee_id);
            if (req.query.type === 'leave') {
              payloadArray[i].is_leave = 1;
              presenceType = 'cuti';
            } else if (req.query.type === 'holiday') {
              payloadArray[i].is_holiday = 1;
              presenceType = 'libur';
            } else if (req.query.type === 'permit') {
              payloadArray[i].is_permit = 1;
              presenceType = 'izin';
            }

            /**
             * Zero salary groups length indicates that user still use data from V1
             */
            if (!salaryMember.salary_groups.length) {
              payloadJournal.push({
                employee_id: payloadArray[i].employee_id,
                type: 'salary',
                debet: salaryMember.daily_salary || 0,
                kredit: 0,
                description: `Gaji ${presenceType} tanggal ${payloadArray[i].presence_date}`,
                created_at: new Date(payloadArray[i].presence_date),
                updated_at: new Date(payloadArray[i].presence_date)
              });
            } else {
              /**
               * Salary groups length more than one indicates user have new data from V2
               */
              let isScheduled = [];
              isScheduled = await scheduleTemplatesHelpers(
                payloadArray[i].presence_date,
                payloadArray[i].employee_id,
                company_id,
                true
              );
              if (!isScheduled.length) {
                isScheduled = await definedSchedulesHelpers(
                  payloadArray[i].presence_date,
                  company_id,
                  payloadArray[i].employee_id
                );
              }
              if (salaryMember.salary_groups[0].salary_type === '1') {
                const rangedDate = dateProcessor.getRangedDate(companyData.setting.payroll_date);
                let workdays;
                // IF MEMBER HAVE DAILY FREQUENT ON THEIR SALARY GROUP
                if (salaryMember.salary_groups[0].daily_frequent) {
                  const dailyFrequent = salaryMember.salary_groups[0].daily_frequent;
                  workdays = countWorkdays(dailyFrequent, rangedDate.dateStart, rangedDate.dateEnd);
                } else {
                  // IF MEMBER DOESNT HAVE DAILY FREQUENT ON THEIR SALARY GROUP, COUNT WORKDAYS BASED ON SCHEDULE INSTEAD
                  workdays = await countTotalSchedule(
                    payloadArray[i].employee_id,
                    rangedDate.dateStart,
                    rangedDate.dateEnd
                  );
                }
                // ONLY ADD MONTHLY SALARY IF THERE IS AT LEAST ONE WORKDAYS IN A MONTH
                if (workdays) {
                  salaryPerday = salaryMember.salary_groups[0].salary / workdays;
                  payloadJournal.push({
                    employee_id: payloadArray[i].employee_id,
                    type: 'salary',
                    debet: salaryPerday,
                    kredit: 0,
                    description: `Gaji ${presenceType} tanggal ${payloadArray[i].presence_date}`,
                    created_at: new Date(payloadArray[i].presence_date),
                    updated_at: new Date(payloadArray[i].presence_date)
                  });
                } else {
                  // COLLECT MEMBER NAME THAT DOESNT HAVE WORKDAYS AT ALL IN A MONTH
                  warningMessage.push(salaryMember.user.full_name);
                }
              } else {
                // ONLY ADD SHIFT SALARY IF THERE IS SCHEDULE AVAILABLE IN CURRENT DATE
                if (isScheduled.length && isScheduled[0].shift) {
                  // USE SALARY THAT STORED AT SHIFT <-> V2.1
                  if (isScheduled[0].shift.schedule_shift.salary) {
                    salaryPerday = isScheduled[0].shift.schedule_shift.salary;
                  }
                  if (
                    !isScheduled[0].shift.schedule_shift.salary &&
                    isScheduled[0].shift.schedule_shift.shift_multiply
                  ) {
                    // USE SALARY THAT STORED AT SALARY GROUP, THEN MULTIPLY IT <-> V2.0
                    salaryPerday =
                      salaryMember.salary_groups[0].salary *
                      parseInt(isScheduled[0].shift.schedule_shift.shift_multiply);
                  }
                  payloadJournal.push({
                    employee_id: payloadArray[i].employee_id,
                    type: 'salary',
                    debet: salaryPerday,
                    kredit: 0,
                    description: `Gaji ${presenceType} tanggal ${payloadArray[i].presence_date}`,
                    created_at: new Date(payloadArray[i].presence_date),
                    updated_at: new Date(payloadArray[i].presence_date)
                  });
                } else {
                  // COLLECT MEMBER NAME THAT DOESNT HAVE SCHEDULE FOR GIVEN DATE
                  warningShiftMessage.push(salaryMember.user.full_name);
                }
              }
            }
            if (data.notes) {
              payloadNotes.push({
                employee_id: payloadArray[i].employee_id,
                date: payloadArray[i].presence_date,
                notes: data.notes
              });
            }
            delete payloadArray[i].presence_start;
            delete payloadArray[i].presence_end;
          }
          if (payloadNotes.length) {
            await EmployeeNote.bulkCreate(payloadNotes);
          }
          presence = await Presence.bulkCreate(payloadArray);

          const journal = await Journal.bulkCreate(payloadJournal);

          if (!journal) {
            if (isReturn === true) {
              return res
                .status(400)
                .json(response(false, 'Gagal mencatat presensi ke jurnal keuangan'));
            }
            return { status: false, message: 'Gagal mencatat presensi ke jurnal keuangan' };
          }

          responseMessage = `Berhasil membuat presensi manual ${presenceType}. `;
          if (warningMessage.length) {
            let message;
            responsePayload.showAlert = true;
            const memberList = warningMessage.toString().replace(/,/g, ', ');
            const rangedDate = dateProcessor.getRangedDate(companyData.setting.payroll_date);
            message = `Anggota ${memberList} tidak mendapatkan gaji bulanan karena tidak ada jadwal sama sekali untuk ${
              warningMessage.length === 1 ? 'dia' : 'mereka'
            } di rentang tanggal ${rangedDate.dateStart} s/d ${rangedDate.dateEnd}. `;
            responseMessage = responseMessage.concat(message);
          }
          if (warningShiftMessage.length) {
            let message;
            const memberList = warningShiftMessage.toString().replace(/,/g, ', ');
            responsePayload.showAlert = true;
            if (warningMessage.length) {
              message = `Sedangkan untuk anggota ${memberList} tidak mendapatkan gaji shift karena tidak ada jadwal untuk ${
                warningShiftMessage.length === 1 ? 'dia' : 'mereka'
              } di antara tanggal ${arrayDate[0]} s/d ${arrayDate[arrayDate.length - 1]}`;
            } else {
              message = `Anggota ${memberList} tidak mendapatkan gaji shift karena tidak ada jadwal untuk ${
                warningShiftMessage.length === 1 ? 'dia' : 'mereka'
              } di antara tanggal ${arrayDate[0]} s/d ${arrayDate[arrayDate.length - 1]}`;
            }
            responseMessage = responseMessage.concat(message);
          }
        } else if (req.query.type === 'absence') {
          for (let i = 0; i < payloadArray.length; i++) {
            payloadArray[i].is_absence = 1;
            delete payloadArray[i].presence_start;
            delete payloadArray[i].presence_end;
          }
          presence = await Presence.bulkCreate(payloadArray);
          responseMessage = 'Berhasil membuat presensi manual tidak masuk';
        } else {
          if (isReturn === true) {
            return res.status(422).json(response(false, 'Wrong type request'));
          }
          return { status: false, message: 'Wrong type request' };
        }
      }
      /*
       *  IF type of presence is masuk kerja
       */
      if (!req.query.type) {
        /*
         *  Check presence overdue
         */

        for (let i = 0; i < payloadArray.length; i++) {
          let presenceOverdue = 0;
          let totalHomeEarlyTime = 0;
          let homeEarlyDeduction = 0;
          let overdueDeduction = 0;
          let salaryMember = employeeData.find(data => data.id === payloadArray[i].employee_id);
          // Find Existing Presence
          const presenceExist = presence.filter(
            val =>
              val.presence_date === payloadArray[i].presence_date &&
              val.employee_id === payloadArray[i].employee_id
          );

          // Find Schedule
          let isScheduled = [];
          const scheduleTemplates = await scheduleTemplatesHelpers(
            payloadArray[i].presence_date,
            payloadArray[i].employee_id,
            company_id,
            true
          );
          const definedSchedules = await definedSchedulesHelpers(
            payloadArray[i].presence_date,
            company_id,
            payloadArray[i].employee_id
          );
          isScheduled = scheduleTemplates.concat(definedSchedules);
          const timeDeviations = [];
          let index = 0;
          // Find Closest Schedule Time Deviation Between Start Time on Schedule and Presence Start on Presence
          if (isScheduled.length) {
            for (const [index, value] of isScheduled.entries()) {
              let startTime = value.shift
                ? value.shift.schedule_shift.start_time
                : value.start_time || value.presence_start;
              startTime = startTime.split(':');
              let presenceStart = new Date(`${payloadArray[i].presence_start} -0700`);
              presenceStart = new Date(presenceStart.setDate(presenceStart.getDate() - 1));
              const newStartTime = new Date(
                presenceStart.getFullYear(),
                presenceStart.getMonth(),
                presenceStart.getDate(),
                startTime[0],
                startTime[1]
              );
              const deviation = Math.abs(Math.floor(presenceStart - newStartTime) / (1000 * 60));
              const compose = {
                deviation,
                index
              };
              timeDeviations.push(compose);
            }
            const lowestDeviation = timeDeviations.reduce((prev, curr) =>
              prev.deviation < curr.deviation ? prev : curr
            );
            index = lowestDeviation.index;
          }

          if (!salaryMember.salary_groups.length) {
            // Zero salary groups length indicates that user still use data from V1
            presenceOverdue = await presenceOverdueCheckV1(
              new Date(`${payloadArray[i].presence_start} -0700`),
              payloadArray[i].employee_id
            );
          } else if (salaryMember.salary_groups.length && isScheduled.length) {
            // Salary groups length more than one indicates user have new data from V2
            let startTime = isScheduled[index].shift
              ? isScheduled[index].shift.schedule_shift.start_time
              : isScheduled[index].start_time || isScheduled[index].presence_start;
            const presenceStart = new Date(`${payloadArray[i].presence_start} -0700`);
            const scheduleStartTime = new Date(
              presenceStart.getFullYear(),
              presenceStart.getMonth(),
              presenceStart.getDate(),
              startTime.split(':')[0],
              startTime.split(':')[1]
            );
            presenceOverdue = Math.floor((presenceStart - scheduleStartTime) / (1000 * 60));
          }

          const workHours =
            Math.abs(payloadArray[i].presence_start - payloadArray[i].presence_end) / 36e5;
          const overWorked = Math.floor(workHours - companyData.setting.overwork_limit);
          const overwork = overWorked < 0 ? 0 : overWorked;

          payloadArray[i].overwork = overwork;
          payloadArray[i].work_hours = workHours.toFixed(2);

          if (parseInt(presenceOverdue) > parseInt(companyData.setting.presence_overdue_limit)) {
            // Insert presence overdue if beyond threshold
            payloadArray[i].presence_overdue =
              presenceOverdue - companyData.setting.presence_overdue_limit;
          }

          /*
           *  Check rest overdue
           */
          let restOverdueCal = -1;

          if (restStart && restEnd) {
            const totalRest = Math.floor(
              Math.abs(payloadArray[i].rest_end - payloadArray[i].rest_start) / (1000 * 60)
            ); // minutes
            const totalRestHour =
              Math.abs(payloadArray[i].rest_end - payloadArray[i].rest_start) / 36e5; // hour
            restOverdueCal = Math.floor(totalRest - companyData.setting.rest_limit);

            payloadArray[i].work_hours = (workHours - totalRestHour).toFixed(2);
          }

          const restOverdue = restOverdueCal < 0 ? 0 : restOverdueCal;

          payloadArray[i].rest_overdue = restOverdue;
          let isShiftAvailable = false;
          let isWorkdayAvailable = false;

          if (!salaryMember.salary_groups.length && !presenceExist.length) {
            // Zero salary groups length indicates that user still use data from V1
            payloadJournal.push({
              employee_id: payloadArray[i].employee_id,
              type: 'salary',
              debet: salaryMember.daily_salary_with_meal || salaryMember.daily_salary || 0,
              kredit: 0,
              description: `Gaji masuk tanggal ${payloadArray[i].presence_date}`,
              created_at: new Date(payloadArray[i].presence_date),
              updated_at: new Date(payloadArray[i].presence_date),
              include_lunch_allowance: 1,
              include_transport_allowance: 1
            });
          } else {
            // Salary groups length more than one indicates user have new data from V2

            // Count Home Early
            if (isScheduled.length) {
              let scheduleEndTime = isScheduled[index].shift
                ? isScheduled[index].shift.schedule_shift.end_time
                : isScheduled[index].end_time || isScheduled[index].presence_end;
              const presenceEnd = new Date(`${payloadArray[i].presence_end} -0700`);
              const endTime = new Date(
                presenceEnd.getFullYear(),
                presenceEnd.getMonth(),
                presenceEnd.getDate() + isScheduled[index].shift
                  ? isScheduled[index].shift.schedule_shift.is_tommorow
                  : 0,
                scheduleEndTime.split(':')[0],
                scheduleEndTime.split(':')[1]
              );
              totalHomeEarlyTime = Math.floor((endTime - presenceEnd) / (1000 * 60));
              if (totalHomeEarlyTime > 0) {
                payloadArray[i].home_early = totalHomeEarlyTime;
                homeEarlyDeduction = totalHomeEarlyTime * companyData.setting.home_early_deduction;
              }
            }
            // Count Overdue
            if (payloadArray[i].presence_overdue) {
              overdueDeduction = presenceOverdue * companyData.setting.late_deduction;
            }

            /*
             *  payload Journal
             */
            let allowance;
            // IF MEMBER HAS NEWEST ALLOWANCE DATA FROM V2.1

            if (salaryMember.salary_groups[0].dataValues.allowances[0].amount) {
              allowance = salaryMember.salary_groups[0].dataValues.allowances[0].amount;
            } else {
              // IF MEMBER HAS OLD ALLOWANCE DATA FROM V2.0
              allowance =
                salaryMember.salary_groups[0].transport_allowance +
                salaryMember.salary_groups[0].lunch_allowance;
            }

            // Salary Type 1 Mean Bulanan
            if (salaryMember.salary_groups[0].salary_type === '1') {
              const rangedDate = dateProcessor.getRangedDate(companyData.setting.payroll_date);
              let workdays;
              // IF MEMBER HAVE DAILY FREQUENT ON THEIR SALARY GROUP <-> V2.1
              if (salaryMember.salary_groups[0].daily_frequent) {
                const dailyFrequent = salaryMember.salary_groups[0].daily_frequent;
                workdays = countWorkdays(dailyFrequent, rangedDate.dateStart, rangedDate.dateEnd);
              } else {
                // IF MEMBER DOESNT HAVE DAILY FREQUENT ON THEIR SALARY GROUP, COUNT WORKDAYS BASED ON SCHEDULE INSTEAD <-> V2.1
                workdays = await countTotalSchedule(
                  payloadArray[i].employee_id,
                  rangedDate.dateStart,
                  rangedDate.dateEnd
                );
              }
              // ONLY ADD SALARY IF THERE IS SCHEDULE AVAILABLE AND FIRST TIME TO PRESENCE
              if (workdays && !presenceExist.length) {
                isWorkdayAvailable = true;
                salaryPerday =
                  salaryMember.salary_groups[0].salary / workdays + parseInt(allowance);
                payloadJournal.push({
                  employee_id: payloadArray[i].employee_id,
                  type: 'salary',
                  debet: salaryPerday,
                  kredit: 0,
                  description: `Gaji masuk tanggal ${payloadArray[i].presence_date}`,
                  created_at: new Date(payloadArray[i].presence_date),
                  updated_at: new Date(payloadArray[i].presence_date),
                  include_lunch_allowance: 1,
                  include_transport_allowance: 1
                });
              }
              // COLLECT MEMBER NAME THAT DOESNT HAVE SCHEDULE
              if (!isWorkdayAvailable) warningMessage.push(salaryMember.user.full_name);
              // Salary Type 2 Mean Shift
            } else {
              // ONLY ADD SHIFT SALARY IF THERE IS SCHEDULE AVAILABLE IN CURRENT DATE
              if (isScheduled.length && !presenceExist.length) {
                if (isScheduled[index].shift) {
                  isShiftAvailable = true;
                  // USE SALARY THAT STORED AT SHIFT <-> V2.1
                  if (isScheduled[index].shift.schedule_shift.salary) {
                    salaryPerday = isScheduled[index].shift.schedule_shift.salary;
                  }
                  if (
                    !isScheduled[index].shift.schedule_shift.salary &&
                    isScheduled[index].shift.schedule_shift.shift_multiply
                  ) {
                    // USE SALARY THAT STORED AT SALARY GROUP, THEN MULTIPLY IT <-> V2.0
                    salaryPerday =
                      salaryMember.salary_groups[0].salary *
                      parseInt(isScheduled[index].shift.schedule_shift.shift_multiply);
                  }
                  salaryPerday = salaryPerday + parseInt(allowance);
                  payloadJournal.push({
                    employee_id: payloadArray[i].employee_id,
                    type: 'salary',
                    debet: salaryPerday,
                    kredit: 0,
                    description: `Gaji masuk tanggal ${payloadArray[i].presence_date}`,
                    created_at: new Date(payloadArray[i].presence_date),
                    updated_at: new Date(payloadArray[i].presence_date),
                    include_lunch_allowance: 1,
                    include_transport_allowance: 1
                  });
                }
              }
              // COLLECT MEMBER NAME THAT DOESNT HAVE SCHEDULE FOR TODAY
              if (!isShiftAvailable) warningShiftMessage.push(salaryMember.user.full_name);
            }
          }

          if (data.bonus) {
            payloadJournal.push({
              employee_id: payloadArray[i].employee_id,
              type: 'other',
              debet: data.bonus,
              kredit: 0,
              description: `Bonus tanggal ${payloadArray[i].presence_date}`,
              created_at: new Date(payloadArray[i].presence_date),
              updated_at: new Date(payloadArray[i].presence_date)
            });
          }

          if (data.penalty) {
            payloadJournal.push({
              employee_id: payloadArray[i].employee_id,
              type: 'other',
              debet: 0,
              kredit: data.penalty,
              description: `Denda tanggal ${payloadArray[i].presence_date}`,
              created_at: new Date(payloadArray[i].presence_date),
              updated_at: new Date(payloadArray[i].presence_date)
            });
          }

          if (data.notes) {
            payloadNotes.push({
              employee_id: payloadArray[i].employee_id,
              date: payloadArray[i].presence_date,
              notes: data.notes,
              created_at: new Date(payloadArray[i].presence_date),
              updated_at: new Date(payloadArray[i].presence_date)
            });
          }

          if (data.bonus_note) {
            payloadBonusNote.push({
              employee_id: payloadArray[i].employee_id,
              date: payloadArray[i].presence_date,
              notes: data.bonus_note,
              amount: data.bonus,
              type: 1,

              created_at: new Date(payloadArray[i].presence_date),
              updated_at: new Date(payloadArray[i].presence_date)
            });
          }

          if (data.penalty_note) {
            payloadBonusNote.push({
              employee_id: payloadArray[i].employee_id,
              date: payloadArray[i].presence_date,
              notes: data.penalty_note,
              amount: data.penalty,
              type: 2,
              created_at: new Date(payloadArray[i].presence_date),
              updated_at: new Date(payloadArray[i].presence_date)
            });
          }
          if (homeEarlyDeduction) {
            payloadJournal.push({
              employee_id: payloadArray[i].employee_id,
              type: 'other',
              kredit: homeEarlyDeduction,
              description: `Denda pulang lebih awal tanggal ${payloadArray[i].presence_end}`,
              created_at: new Date(payloadArray[i].presence_date),
              updated_at: new Date(payloadArray[i].presence_date)
            });
            payloadBonusNote.push({
              employee_id: payloadArray[i].employee_id,
              type: 2,
              date: payloadArray[i].presence_date,
              notes: `Potongan pulang lebih awal selama ${totalHomeEarlyTime} menit sebesar Rp.${formatCurrency(
                homeEarlyDeduction
              )}`,
              created_at: new Date(payloadArray[i].presence_date),
              updated_at: new Date(payloadArray[i].presence_date)
            });
          }
          if (overdueDeduction) {
            payloadJournal.push({
              employee_id: payloadArray[i].employee_id,
              type: 'other',
              kredit: overdueDeduction,
              description: `Denda terlambat tanggal ${payloadArray[i].presence_end}`,
              created_at: new Date(payloadArray[i].presence_date),
              updated_at: new Date(payloadArray[i].presence_date)
            });
            payloadBonusNote.push({
              employee_id: payloadArray[i].employee_id,
              type: 2,
              date: payloadArray[i].presence_date,
              notes: `Potongan terlambat selama ${presenceOverdue} menit sebesar Rp.${formatCurrency(
                overdueDeduction
              )}`,
              created_at: new Date(payloadArray[i].presence_date),
              updated_at: new Date(payloadArray[i].presence_date)
            });
          }
        }

        /*
         * Let's insert the data
         */
        presence = await Presence.bulkCreate(payloadArray);

        if (!presence) {
          if (isReturn === true) {
            return res.status(400).json(response(false, 'Gagal membuat presensi manual'));
          }
          return { status: false, message: 'Gagal membuat presensi manual' };
        }

        const journal = await Journal.bulkCreate(payloadJournal);

        if (!journal) {
          if (isReturn === true) {
            return res
              .status(400)
              .json(response(false, 'Gagal mencatat presensi ke jurnal keuangan'));
          }
          return { status: false, message: 'Gagal mencatat presensi ke jurnal keuangan' };
        }

        if (data.notes) {
          notes = await EmployeeNote.bulkCreate(payloadNotes);

          if (!notes) {
            if (isReturn === true) {
              return res.status(400).json(response(false, 'Gagal membuat catatan presensi'));
            }
            return { status: false, message: 'Gagal membuat catatan presensi' };
          }
        }

        if (payloadBonusNote.length) {
          bonusNote = await EmployeeNote.bulkCreate(payloadBonusNote);

          if (!bonusNote) {
            if (isReturn === true) {
              return res.status(400).json(response(false, 'Gagal membuat catatan bonus'));
            }
            return { status: false, message: 'Gagal membuat catatan bonus' };
          }
        }

        if (data.penalty_note) {
          penaltyNote = await EmployeeNote.bulkCreate(payloadPenaltyNote);

          if (!penaltyNote) {
            if (isReturn === true) {
              return res.status(400).json(response(false, 'Gagal membuat catatan potongan'));
            }
            return { status: false, message: 'Gagal membuat catatan potongan' };
          }
        }
        responseMessage = `Berhasil membuat presensi manual. `;
        if (warningMessage.length) {
          let message;
          responsePayload.showAlert = true;
          const memberList = warningMessage.toString().replace(/,/g, ', ');
          const rangedDate = dateProcessor.getRangedDate(companyData.setting.payroll_date);
          message = `Anggota ${memberList} tidak mendapatkan gaji bulanan karena tidak ada jadwal sama sekali untuk ${
            warningMessage.length === 1 ? 'dia' : 'mereka'
          } di rentang tanggal ${rangedDate.dateStart} s/d ${rangedDate.dateEnd}. `;
          responseMessage = responseMessage.concat(message);
        }
        if (warningShiftMessage.length) {
          let message;
          const memberList = warningShiftMessage.toString().replace(/,/g, ', ');
          responsePayload.showAlert = true;
          if (warningMessage.length) {
            message = `Sedangkan untuk anggota ${memberList} tidak mendapatkan gaji shift karena tidak ada jadwal untuk ${
              warningShiftMessage.length === 1 ? 'dia' : 'mereka'
            } di antara tanggal ${arrayDate[0]} s/d ${arrayDate[arrayDate.length - 1]}`;
          } else {
            message = `Anggota ${memberList} tidak mendapatkan gaji shift karena tidak ada jadwal untuk ${
              warningShiftMessage.length === 1 ? 'dia' : 'mereka'
            } di antara tanggal ${arrayDate[0]} s/d ${arrayDate[arrayDate.length - 1]}`;
          }
          responseMessage = responseMessage.concat(message);
        }
      }
      // SEND ACTIVITY NOTIFICATION
      const checkUser = await User.findOne({ where: { id } });
      const description = `${checkUser.full_name} telah membuat presensi manual ${presenceType} untuk anggota ${memberNames}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      if (isReturn === true) {
        return res.status(201).json(response(true, responseMessage, responsePayload));
      }
      return { status: true, responseMessage, responsePayload };
    } catch (error) {
      if (error.errors) {
        if (isReturn === true) {
          return res.status(400).json(response(false, error.errors));
        }
        return { status: false, error: error.errors };
      }
      if (isReturn === true) {
        return res.status(400).json(response(false, error.message));
      }
      return { status: false, error: error.message };
    }
  },
  patch: async (req, res) => {
    const { presence_id: presenceId } = req.params;
    const { data } = req.body;
    const { id, employeeId } = res.local.users;
    try {
      const presences = await Presence.findOne({
        where: { id: presenceId },
        include: { model: Employee, include: { model: User, attributes: ['full_name'] } }
      });
      if (!presences) {
        return res.status(400).json(response(false, 'Wrong id of presence, data not available'));
      }

      const employeeData = await Employee.findOne({
        where: { user_id: presences.employee.user_id },
        include: [
          {
            model: Companies,
            include: [{ model: CompanySettings, as: 'setting' }]
          },
          {
            model: SalaryGroup,
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

      let work_hours;
      let overwork;
      let rest_overdue;
      let presenceOverdue = 0;
      let salaryPerday;

      let payload = Object.assign({}, data);
      if (data.presence_end || data.presence_start) {
        let restHour = 0;
        const presenceStart = data.presence_start ? new Date(`${data.presence_start} -0700`) : null;
        const presenceEnd = data.presence_end ? new Date(`${data.presence_end} -0700`) : null;

        if (presences.rest_start && presences.rest_end) {
          const restStart = new Date(presences.rest_start);
          const restEnd = new Date(presences.rest_end);
          restHour = Math.abs(restEnd - restStart) / 36e5;
        }

        if (!employeeData.salary_groups.length) {
          presenceOverdue = await presenceOverdueCheckV1(
            new Date(`${presenceStart ? presenceStart : presences.presence_start}`),
            employeeData.id
          );
        } else {
          presenceOverdue = await presenceOverdueCheckV2(
            new Date(`${presenceStart ? presenceStart : presences.presence_start}`),
            employeeData.id
          );
        }

        if (presences.presence_end || data.presence_end) {
          const checkoutDate = new Date(`${presenceStart ? presences.presence_end : presenceEnd}`);
          const checkining = new Date(presenceStart ? presenceStart : presences.presence_start);
          work_hours = Math.abs(checkining - new Date(`${checkoutDate}`)) / 36e5;
          const overWorked = work_hours - restHour - employeeData.company.setting.overwork_limit;
          overwork = overWorked < 0 ? 0 : overWorked;

          payload = Object.assign(payload, {
            overwork: overwork,
            work_hours: (work_hours - restHour).toFixed(2)
          });
        }

        const countPresenceOverdue =
          presenceOverdue - employeeData.company.setting.presence_overdue_limit;

        // Assign Presence Overdue to Payload
        payload.presence_overdue =
          countPresenceOverdue > 0
            ? presenceOverdue - employeeData.company.setting.presence_overdue_limit
            : 0;

        /*
         *  payload Journal
         */
        if (presences.presence_end || data.presence_end) {
          let payloadJournal;
          if (!employeeData.salary_groups.length) {
            payloadJournal = {
              employee_id: employeeData.id,
              type: 'salary',
              debet: employeeData.daily_salary_with_meal || employeeData.daily_salary,
              kredit: 0,
              description: `Gaji harian tanggal ${presences.presence_date}`,
              created_at: new Date(presences.presence_date),
              updated_at: new Date(presences.presence_date)
            };
          } else {
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
            // Salary Type 1 Mean Bulanan
            if (employeeData.salary_groups[0].salary_type === '1') {
              const rangedDate = dateProcessor.getRangedDate(
                employeeData.company.setting.payroll_date
              );
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
              salaryPerday = employeeData.salary_groups[0].salary / workdays + parseInt(allowance);
              payloadJournal = {
                employee_id: employeeData.id,
                type: 'salary',
                debet: salaryPerday,
                kredit: 0,
                description: `Gaji harian tanggal ${presences.presence_date}`,
                include_lunch_allowance: 1,
                include_transport_allowance: 1,
                created_at: new Date(presences.presence_date),
                updated_at: new Date(presences.presence_date)
              };
              // Salary Type 2 Mean Shift
            } else {
              let isScheduled = [];
              isScheduled = await scheduleTemplatesHelpers(
                presences.presence_date,
                employeeData.id,
                employeeData.company_id,
                true
              );
              if (!isScheduled.length) {
                isScheduled = await definedSchedulesHelpers(
                  presences.presence_date,
                  employeeData.company_id,
                  employeeData.id
                );
              }
              // USE SALARY THAT STORED AT SHIFT <-> V2.1
              if (isScheduled[0].shift.schedule_shift.salary) {
                salaryPerday = isScheduled[0].shift.schedule_shift.salary;
              }
              if (
                !isScheduled[0].shift.schedule_shift.salary &&
                isScheduled[0].shift.schedule_shift.shift_multiply
              ) {
                // USE SALARY THAT STORED AT SALARY GROUP, THEN MULTIPLY IT <-> V2.0
                salaryPerday =
                  employeeData.salary_groups[0].salary *
                  parseInt(isScheduled[0].shift.schedule_shift.shift_multiply);
              }
              salaryPerday = salaryPerday + parseInt(allowance);
              payloadJournal = {
                employee_id: employeeData.id,
                type: 'salary',
                debet: salaryPerday,
                kredit: 0,
                description: `Gaji harian tanggal ${presences.presence_date}`,
                include_lunch_allowance: 1,
                include_transport_allowance: 1,
                created_at: new Date(presences.presence_date),
                updated_at: new Date(presences.presence_date)
              };
            }
          }

          let journal = await Journal.findOne({
            where: [
              { employee_id: employeeData.id, type: 'salary' },
              Sequelize.where(
                Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
                presences.presence_date
              )
            ]
          });

          if (!journal) {
            journal = await Journal.create(payloadJournal);
            if (!journal) {
              return res
                .status(400)
                .json(response(false, 'Gagal mencatat upah presensi ke jurnal keuangan'));
            }
          }
        }
        // WAITING ANSWER IF IT NEED UPDATED OR NOT WHEN CHANGING PRESENCES
        // else {
        //   journal = await Journal.update(payloadJournal, {
        //     where: Sequelize.where(
        //       Sequelize.fn(
        //         'DATE_FORMAT',
        //         Sequelize.col('created_at'),
        //         '%Y-%m-%d'
        //       ),
        //       presences.presence_date
        //     )
        //   });
        //   if (!journal) {
        //     return res
        //       .status(400)
        //       .json(
        //         response(
        //           false,
        //           'Gagal mencatat upah presensi ke jurnal keuangan'
        //         )
        //       );
        //   }
        // }
      }

      if (data.rest_end) {
        const restEnd = new Date(`${data.rest_end} -0700`);
        const started = new Date(presences.rest_start);
        const totalRest = Math.floor(Math.abs(restEnd - started) / (1000 * 60)); // minutes
        const totalRestHour = Math.abs(restEnd - started) / 36e5; // hour
        const checklog = {
          checkIn: new Date(presences.presence_start),
          checkOut: new Date(presences.presence_end)
        };
        const workHour = Math.abs(checklog.checkIn - checklog.checkOut) / 36e5;
        const restOverdue = Math.floor(totalRest - employeeData.company.setting.rest_limit);
        const overWorked = workHour - totalRestHour - employeeData.company.setting.overwork_limit;
        overwork = overWorked < 0 ? 0 : overWorked;
        rest_overdue = restOverdue < 0 ? 0 : restOverdue;
        payload = Object.assign(payload, {
          rest_overdue: rest_overdue,
          work_hours: (workHour - totalRestHour).toFixed(2),
          overwork
        });
      }

      const updatePresence = await Presence.update(payload, { where: { id: presenceId } });
      if (!updatePresence) {
        return res.status(400).json(response(false, 'Presence data not updated'));
      }
      // SEND ACTIVITY NOTIFICATION
      const checkUser = await User.findOne({ where: { id } });
      const description = `${checkUser.full_name} telah mengubah waktu presensi untuk anggota ${presences.employee.user.full_name}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      return res.status(201).json(response(true, 'Waktu presensi telah berhasil diubah'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = presenceService;

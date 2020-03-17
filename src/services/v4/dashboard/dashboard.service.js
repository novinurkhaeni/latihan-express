/* eslint-disable indent */
require('module-alias/register');
const {
  response,
  scheduleTemplates: scheduleTemplatesHelper,
  definedSchedules: definedSchedulesHelper,
  timeShorten,
  scheduleOrder,
  dateConverter,
  dateGenerator
} = require('@helpers');
const {
  journals: Journals,
  employees: Employee,
  companies: Company,
  journal_details: JournalDetail,
  digital_assets: DigitalAsset,
  users: User,
  presences: Presence,
  home_dumps: HomeDump,
  submissions: Submission,
  schedule_templates: ScheduleTemplate,
  defined_schedules: DefinedSchedule,
  salary_groups: SalaryGroup,
  parent_companies: ParentCompany,
  company_settings: CompanySetting
} = require('@models');
const Sequelize = require('sequelize');
const { Op } = Sequelize;

const dashboardService = {
  get: async (req, res) => {
    const { start: start, end: end, dateInfo: today } = req.query;
    const { company_id: companyId } = req.params;
    const { employeeId, companyParentId } = res.local.users;
    try {
      const date = new Date();
      date.setHours(date.getHours() + 7);
      const formattedDate = dateConverter(date);
      // const today = `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(
      //   -2
      // )}-${date.getDate()}`;
      let employeeIdArray = [];
      let companyIdArray = companyId.split(',');
      let depositTotal = 0;
      let allDepositTotal = 0;
      let journalData = null;
      let subscribeTotal = null;
      let withdrawData = null;
      let allWithdrawData = null;
      let withdrawBill = null;
      let employees = null;
      let eligibleEmployees = 0;
      let salaryDebit = 0;
      let salaryDebitWithoutBonus = 0;
      let progressiveSalary = 0;
      let salaryCredit = 0;
      let rangedGrossWithdraws = 0;
      // let withdrawable = null;
      let netSalary = null;
      let schedules = [];
      let notYetCheckIn = [];
      let notYetCheckOut = [];
      let scheduleToTake = [];
      let outOfSchedule;
      let restOverdue;
      let presenceOverdue;
      let overwork;
      let homeEarly;
      let approvedMemberWithdraw;
      let memberWithdraw = [];
      let scheduleTemplates = [];
      let todayPresence = null;
      let todayScheduleDescription = null;
      let bonusSubmissions = [];
      const company = await Company.findOne({ where: { id: companyIdArray } });
      if (!company) {
        return res.status(400).json(response(false, 'Wrong company ID'));
      }
      const employeeData = await Employee.findOne({
        where: { id: employeeId },
        include: [
          { model: User },
          {
            model: Company,
            attributes: ['id'],
            include: { model: ParentCompany, attributes: ['pay_gajiandulu_status'] }
          }
        ]
      });

      const dumps = await HomeDump.findAll({
        where: [
          { parent_company_id: companyParentId },
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
            today
          )
        ]
      });

      const restDuration = await CompanySetting.findOne({
        where: { company_id: companyIdArray },
        attributes: ['rest_limit']
      });

      const checkEmployee = await Employee.findOne({
        where: { company_id: companyIdArray, role: 2 }
      });
      const checkScheduleTemplate = await ScheduleTemplate.findOne({
        where: { company_id: companyIdArray }
      });
      const checkDefinedSchedule = await DefinedSchedule.findOne({
        where: { company_id: 200 }
      });
      const checkSalaryGroup = await SalaryGroup.findOne({ where: { company_id: companyIdArray } });

      const balanceDate = await Journals.findOne({
        attributes: [[Sequelize.fn('max', Sequelize.col('journals.created_at')), 'created_at']],
        where: { balance: 1, type: 'payment' },
        include: { model: Employee, attributes: [], where: { company_id: companyIdArray } },
        group: ['journals.employee_id', 'employee.id']
      });

      // Total salary and withdraw bill only manager can see
      if (employeeData.role.toString() !== '2') {
        employees = await Employee.findAll({
          where: { company_id: companyIdArray, flag: 3, active: 1 }
        });
        for (let i = 0; i < employees.length; i++) {
          employeeIdArray.push(employees[i].id);
          if (employees[i].role !== 1) {
            eligibleEmployees++;
          }
        }

        journalData = await Journals.findOne({
          where: [
            { employee_id: employeeIdArray, on_hold: 0 },
            { type: { [Op.notIn]: ['withdraw', 'subscribe', 'payment', 'fee'] } },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
              '>=',
              `${start}`
            ),
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
              '<=',
              `${end}`
            )
          ],
          attributes: [[Sequelize.fn('SUM', Sequelize.literal('`debet`-`kredit`')), 'total_salary']]
        });

        subscribeTotal = await Journals.findOne({
          where: [
            { company_id: companyIdArray },
            { type: { [Op.or]: ['subscribe', 'payment', 'fee'] } },
            balanceDate !== null && {
              created_at: {
                [Op.gt]: Sequelize.fn('DATE_FORMAT', balanceDate.created_at, '%Y-%m-%d %H:%i:%S')
              }
            }
          ],
          attributes: [
            [Sequelize.fn('SUM', Sequelize.literal('`kredit`-`debet`')), 'total_subscribe']
          ]
        });

        allWithdrawData = await JournalDetail.findAll({
          where: { status: 1 },
          include: {
            model: Journals,
            attributes: [],
            where: [
              { employee_id: employeeIdArray, type: 'withdraw' },
              balanceDate !== null && {
                created_at: {
                  [Op.gt]: Sequelize.fn('DATE_FORMAT', balanceDate.created_at, '%Y-%m-%d %H:%i:%S')
                }
              }
            ]
          }
        });

        withdrawData = await JournalDetail.findAll({
          where: { status: 1 },
          include: {
            model: Journals,
            attributes: ['type', 'employee_id', 'description'],
            where: [
              { employee_id: employeeIdArray, type: 'withdraw' },
              Sequelize.where(
                Sequelize.fn(
                  'DATE_FORMAT',
                  Sequelize.col('journal_details.created_at'),
                  '%Y-%m-%d'
                ),
                '>=',
                `${start}`
              ),
              Sequelize.where(
                Sequelize.fn(
                  'DATE_FORMAT',
                  Sequelize.col('journal_details.created_at'),
                  '%Y-%m-%d'
                ),
                '<=',
                `${end}`
              )
            ]
          }
        });
        if (withdrawData.length) {
          for (let i = 0; i < withdrawData.length; i++) {
            depositTotal += withdrawData[i].total;
          }
        }
        if (allWithdrawData.length) {
          for (let i = 0; i < allWithdrawData.length; i++) {
            allDepositTotal += allWithdrawData[i].total;
          }
        }
        withdrawBill =
          parseInt(allDepositTotal || 0) + parseInt(subscribeTotal.dataValues.total_subscribe || 0);

        // Get members information
        const getScheduleTemplates = await scheduleTemplatesHelper(
          today,
          employeeId,
          companyIdArray
        );

        const getDefinedSchedule = await definedSchedulesHelper(
          today,
          companyIdArray,
          null,
          null,
          true
        );

        /**
         * SUBMISSION SECTION
         */

        // SUBMISSIONS
        const submissions = await Submission.findAll({
          where: { employee_id: employeeIdArray, status: 0 },
          include: {
            model: Employee,
            attributes: ['id'],
            include: [
              { model: User, attributes: ['full_name'] },
              {
                model: DigitalAsset,
                required: false,
                attributes: ['url', 'type'],
                where: {
                  type: 'avatar'
                },
                as: 'assets'
              },
              { model: Company, attributes: ['name', 'company_name'] }
            ]
          }
        });
        // Populate Bonus Submission (Type 5)
        const filteredBonusSubmissions = submissions.filter(val => val.type === 5);
        for (const data of filteredBonusSubmissions) {
          bonusSubmissions.push({
            id: data.id,
            employee_id: data.employee_id,
            submission_id: data.id,
            full_name: data.employee.user.full_name,
            avatar: data.employee.assets.length ? data.employee.assets[0].url : null,
            type: data.type,
            amount: data.amount,
            company_name: data.employee.company.company_name || data.employee.company.name,
            note: data.note
          });
        }

        // Join schedule data from schedule template and defined schedule
        scheduleTemplates = getScheduleTemplates.concat(getDefinedSchedule);
        // remove null result
        // scheduleTemplates = scheduleTemplates.filter(val => val !== null);
        let onScheduleMemberId = [];
        let employeeIdInCompany = [];
        let outOfScheduleMembers = [];
        for (let i = 0; i < scheduleTemplates.length; i++) {
          onScheduleMemberId.push(scheduleTemplates[i].employee.id);
        }
        for (let i = 0; i < employees.length; i++) {
          employeeIdInCompany.push(employees[i].id);
        }
        // Remove Duplicate Member ID
        onScheduleMemberId = Array.from(new Set(onScheduleMemberId));

        // Let know member in the array that don't have schedule today
        const onScheduleEmployeeData = await Employee.findAll({
          where: { id: onScheduleMemberId },
          include: [
            {
              model: Presence,
              attributes: ['id'],
              where: { presence_date: today },
              required: false
            },
            { model: Company, attributes: ['name', 'company_name'] },
            {
              model: User,
              attributes: ['full_name', 'phone']
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
        });
        let mixArray = onScheduleMemberId.concat(employeeIdInCompany);
        for (let i = 0; i < employeeIdInCompany.length; i++) {
          const getId = mixArray.filter(id => id === employeeIdInCompany[i]);
          if (getId.length === 1) {
            outOfScheduleMembers.push(employeeIdInCompany[i]);
          }
        }
        for (let i = 0; i < onScheduleMemberId.length; i++) {
          let rawPresenceStart;
          let rawPresenceEnd;
          const presences = await Presence.findAll({
            where: {
              employee_id: onScheduleMemberId[i],
              presence_date: today,
              presence_start: { [Op.ne]: null }
            }
          });
          // Find Ongoing Presence
          const onGoingPresence = presences.filter(val => val.presence_end === null);
          // Find Completed Presence
          const presenceComplete = presences.filter(val => val.presence_start && val.presence_end);
          let scheduleData = scheduleTemplates.filter(
            value => value.employee.id === onScheduleMemberId[i]
          );
          const originalTotalSchedule = scheduleData.length;
          // Filter Schedule to Match Current Time
          scheduleData.sort((prev, next) => {
            // Sort By Clock ASC
            const prevStartTime = prev.shift
              ? prev.shift.schedule_shift.start_time
              : prev.start_time || prev.end_time;
            const nextStartTime = next.shift
              ? next.shift.schedule_shift.start_time
              : next.start_time || next.end_time;
            if (prevStartTime < nextStartTime) return -1;
            if (prevStartTime > nextStartTime) return 1;
          });
          const timeNow = timeShorten(date);
          const nextSchedules = scheduleData.filter(val => {
            const endTime = val.shift
              ? val.shift.schedule_shift.end_time
              : val.end_time || val.presence_end;
            return timeNow < endTime;
          });
          const prevSchedules = scheduleData.filter(val => {
            const endTime = val.shift
              ? val.shift.schedule_shift.end_time
              : val.end_time || val.presence_end;
            return timeNow > endTime;
          });
          const filteredTotalSchedule = nextSchedules.length;
          const totalScheduleDeviation = originalTotalSchedule - filteredTotalSchedule;
          if (
            nextSchedules.length &&
            onGoingPresence.length + presenceComplete.length - totalScheduleDeviation <= 0
          ) {
            rawPresenceStart = nextSchedules[0].shift
              ? nextSchedules[0].shift.schedule_shift.start_time
              : nextSchedules[0].start_time || nextSchedules[0].presence_start;
            const presenceStart = new Date(today + ' ' + rawPresenceStart);
            if (date > presenceStart) {
              const lateness = Math.abs(date - presenceStart) / 36e5;
              const employeeData = onScheduleEmployeeData.filter(
                value => value.id === onScheduleMemberId[i]
              );
              let employeeDataCopy = employeeData[0].dataValues;
              // CREATE OBJECT CLONE OF EMPLOYEE DATA
              employeeDataCopy = { ...employeeDataCopy };
              employeeDataCopy.lateness = parseFloat(lateness.toFixed(2));
              employeeDataCopy.presenceStart = rawPresenceStart;
              employeeDataCopy.employee = {
                user: employeeDataCopy.user,
                assets: employeeDataCopy.assets
              };
              delete employeeDataCopy.user;
              delete employeeDataCopy.assets;
              notYetCheckIn.push(employeeDataCopy);
            }
          }
          if (prevSchedules.length) {
            for (const [index, value] of prevSchedules.entries()) {
              if (
                index + 1 === onGoingPresence.length + presenceComplete.length &&
                onGoingPresence.length
              ) {
                rawPresenceEnd = value.shift
                  ? value.shift.schedule_shift.end_time
                  : value.end_time || value.presence_end;
                const presenceEnd = new Date(today + ' ' + rawPresenceEnd);
                const lateness = Math.abs(date - presenceEnd) / 36e5;
                const employeeData = onScheduleEmployeeData.filter(
                  value => value.id === onScheduleMemberId[i]
                );
                let employeeDataCopy = employeeData[0].dataValues;
                // CREATE OBJECT CLONE OF EMPLOYEE DATA
                employeeDataCopy = { ...employeeDataCopy };
                employeeDataCopy.lateness = parseFloat(lateness.toFixed(2));
                employeeDataCopy.presenceEnd = rawPresenceEnd;
                employeeDataCopy.employee = {
                  user: employeeDataCopy.user,
                  assets: employeeDataCopy.assets
                };
                delete employeeDataCopy.user;
                delete employeeDataCopy.assets;
                notYetCheckOut.push(employeeDataCopy);
              }
            }
          }
        }

        let onSchedulePresences = await Presence.findAll({
          where: { employee_id: onScheduleMemberId, presence_date: today },
          include: [
            {
              model: Employee,
              attributes: ['id', 'user_id'],
              include: [
                {
                  model: User,
                  attributes: ['full_name']
                },
                { model: Company, attributes: ['name', 'company_name'] },
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
            }
          ]
        });
        outOfSchedule = await Presence.findAll({
          where: {
            employee_id: outOfScheduleMembers,
            presence_date: today,
            presence_start: { [Op.ne]: null },
            presence_end: { [Op.ne]: null }
          },
          include: [
            {
              model: Employee,
              attributes: ['id', 'user_id'],
              include: [
                {
                  model: User,
                  attributes: ['full_name']
                },
                { model: Company, attributes: ['id', 'name', 'company_name'] },
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
            }
          ]
        });

        restOverdue = onSchedulePresences.filter(function(item, index) {
          return (
            item.rest_overdue > 0 &&
            !dumps.filter(
              val =>
                val.identifier === item.rest_start &&
                val.type === 5 &&
                item.employee_id === val.employee_id
            ).length
          );
        });
        presenceOverdue = onSchedulePresences.filter(function(item, index) {
          return (
            item.presence_overdue > 0 &&
            !dumps.filter(
              val =>
                val.identifier === item.presence_start &&
                val.type === 2 &&
                item.employee_id === val.employee_id
            ).length
          );
        });
        overwork = onSchedulePresences.filter(function(item, index) {
          return (
            item.overwork > 0 &&
            !dumps.filter(
              val =>
                val.identifier === item.presence_end &&
                val.type === 7 &&
                item.employee_id === val.employee_id
            ).length
          );
        });
        homeEarly = onSchedulePresences.filter(function(item, index) {
          return (
            item.home_early > 0 &&
            !dumps.filter(
              val =>
                val.identifier === item.presence_end &&
                val.type === 3 &&
                item.employee_id === val.employee_id
            ).length
          );
        });

        notYetCheckIn = notYetCheckIn.filter(function(item, index) {
          return !dumps.filter(
            val =>
              val.identifier === item.presenceStart && val.type === 1 && item.id === val.employee_id
          ).length;
        });

        notYetCheckOut = notYetCheckOut.filter(function(item, index) {
          return !dumps.filter(
            val =>
              val.identifier === item.presenceEnd && val.type === 4 && item.id === val.employee_id
          ).length;
        });

        outOfSchedule = outOfSchedule.filter(function(item, index) {
          return !dumps.filter(
            val =>
              val.identifier === item.presence_start &&
              val.type === 6 &&
              item.employee_id === val.employee_id
          ).length;
        });

        bonusSubmissions = bonusSubmissions.filter(
          (item, index) => !dumps.filter(val => val.identifier == item.id && val.type === 5).length
        );

        approvedMemberWithdraw = await JournalDetail.findAll({
          where: [
            { status: 1 },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('journal_details.created_at'), '%Y-%m-%d'),
              today
            )
          ],
          include: {
            model: Journals,
            where: { employee_id: employeeIdInCompany, type: 'withdraw' },
            include: [
              {
                model: Employee,
                attributes: ['id', 'user_id'],
                include: [
                  {
                    model: User,
                    attributes: ['full_name']
                  },
                  { model: Company, attributes: ['name', 'company_name'] },
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
              }
            ]
          }
        });

        for (let i = 0; i < approvedMemberWithdraw.length; i++) {
          const temp = approvedMemberWithdraw[i];
          temp.dataValues.employee = approvedMemberWithdraw[i].journal.employee;
          delete temp.dataValues.journal;
          memberWithdraw.push(temp);
        }
      }
      if (employeeData.role.toString() !== '1') {
        const rangedDates = dateGenerator(
          formattedDate,
          new Date(new Date().setDate(new Date().getDate() + 7))
        );
        const scheduleToTakes = [];
        // SCHEDULE TO TAKE
        for (const rangedDate of rangedDates) {
          const getScheduleToTakes = await definedSchedulesHelper(
            rangedDate,
            companyIdArray,
            null,
            null,
            false,
            true,
            false,
            false
          );
          for (const getScheduleToTake of getScheduleToTakes) {
            scheduleToTakes.push(getScheduleToTake);
          }
        }

        for (const schedule of scheduleToTakes) {
          const compose = {
            id: schedule.id,
            description: schedule.shift.schedule_shift.shift_name,
            start_time: schedule.shift.schedule_shift.start_time,
            end_time: schedule.shift.schedule_shift.end_time,
            date: schedule.presence_date,
            company: { company_name: schedule.company.company_name || schedule.company.name },
            employee: {}
          };
          scheduleToTake.push(compose);
        }
      }

      // Filter Withdraw Information
      memberWithdraw = memberWithdraw.filter((item, index) => {
        return !dumps.filter(
          val =>
            val.identifier === item.created_at &&
            val.type === 14 &&
            val.employee_id === item.dataValues.employee.id
        ).length;
      });

      /* ================================================
       * Get user salary and schedule except role manager
       * ================================================
       */
      if (employeeData.role.toString() !== '1') {
        const rangedJournalData = await Journals.findAll({
          where: [
            {
              $not: {
                type: 'withdraw'
              }
            },
            { employee_id: employeeId, on_hold: 0 },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
              '>=',
              start
            ),
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
              '<=',
              end
            )
          ],
          attributes: ['type', 'debet', 'kredit', 'description', 'created_at']
        });

        // Get user withdraw info except role manager
        const rangedWithdrawData = await JournalDetail.findAll({
          include: {
            model: Journals,
            attributes: ['type', 'employee_id', 'description'],
            where: [
              { employee_id: employeeId, type: 'withdraw' },
              Sequelize.where(
                Sequelize.fn(
                  'DATE_FORMAT',
                  Sequelize.col('journal_details.created_at'),
                  '%Y-%m-%d'
                ),
                '>=',
                start
              ),
              Sequelize.where(
                Sequelize.fn(
                  'DATE_FORMAT',
                  Sequelize.col('journal_details.created_at'),
                  '%Y-%m-%d'
                ),
                '<=',
                end
              )
            ]
          }
        });

        if (rangedWithdrawData.length > 0) {
          for (let i = 0; i < rangedWithdrawData.length; i++) {
            // if (rangedWithdrawData[i].status.toString() === '0') {
            //   withdrawable += rangedWithdrawData[i].total;
            // }
            if (rangedWithdrawData[i].status.toString() !== '-1') {
              rangedGrossWithdraws += rangedWithdrawData[i].total;
            }
          }
        }

        rangedJournalData.map(journal => {
          if (journal.type === 'salary') salaryDebitWithoutBonus += journal.debet;
          salaryDebit += journal.debet;
          salaryCredit += journal.kredit;
        });

        netSalary = salaryDebit - salaryCredit - rangedGrossWithdraws;
        if (netSalary) {
          netSalary = netSalary * 0.8;
        }
        progressiveSalary = salaryDebitWithoutBonus - salaryCredit;
        // Users' today schedule
        const definedSchedules = await definedSchedulesHelper(
          today,
          companyIdArray,
          employeeId,
          null,
          true
        );
        const scheduleTemplates = await scheduleTemplatesHelper(
          formattedDate,
          employeeId,
          companyIdArray,
          true
        );
        schedules = definedSchedules.concat(scheduleTemplates);

        const { hourDeviation, todaySchedule } = scheduleOrder(schedules);
        if (todaySchedule.length && todaySchedule[0].shift) {
          if (todaySchedule.length) {
            todayScheduleDescription = `${todaySchedule[0].dataValues.start_time_info ||
              todaySchedule[0].shift.schedule_shift.start_time};${todaySchedule[0].dataValues
              .end_time_info || todaySchedule[0].shift.schedule_shift.end_time};${todaySchedule[0]
              .division && todaySchedule[0].division.division.name}`;
          }
        }
        if (todaySchedule.length && !todaySchedule[0].shift) {
          todayScheduleDescription = `${todaySchedule[0].start_time ||
            todaySchedule[0].presence_start};${todaySchedule[0].end_time ||
            todaySchedule[0].presence_end};`;
        }

        let thisDate = new Date();
        thisDate.setHours(thisDate.getHours() + 7 - hourDeviation);
        thisDate = dateConverter(thisDate);
        todayPresence = await Presence.findOne({
          attributes: [
            'company_id',
            'presence_date',
            'presence_start',
            'presence_end',
            'rest_start',
            'rest_end',
            'custom_presence'
          ],
          order: [['id', 'DESC']],
          where: [
            {
              employee_id: employeeId,
              presence_start: { [Op.ne]: null }
            },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('presence_date'), '%Y-%m-%d'),
              thisDate
            )
          ]
        });
      }
      // Count Pending Member
      let pendingMember = 0;
      if (employeeData.role !== 2) {
        const find = await Employee.findAll({
          where: { active: 1, flag: 2, company_id: employeeData.company_id },
          attributes: [[Sequelize.fn('COUNT', Sequelize.col('flag')), 'total']]
        });
        pendingMember = find[0].dataValues.total;
      }
      // For now, set Pass Three Month to TRUE
      let passThreeMonth = true;
      let nextThreeMonth = new Date(employeeData.date_start_work);
      nextThreeMonth = new Date(nextThreeMonth.setMonth(nextThreeMonth.getMonth() + 3));
      if (nextThreeMonth <= date && employeeData.date_start_work) passThreeMonth = true;
      if (nextThreeMonth >= date && employeeData.date_start_work) passThreeMonth = false;

      const roundedNetSalary = netSalary ? Math.floor(netSalary / 10000) * 10000 : 0;

      const payload = Object.assign(
        {},
        {
          id: companyIdArray,
          codename: company.codename,
          company_active: company.active,
          rest_limit: restDuration.rest_limit,
          user_active: employeeData.active,
          role: employeeData.role,
          gajiandulu_status: employeeData.gajiandulu_status,
          flag: employeeData.flag,
          past_three_month: passThreeMonth,
          net_salary: roundedNetSalary >= 500000 ? roundedNetSalary : 0,
          progressive_salary: progressiveSalary,
          // withdrawable_salary: withdrawable || 0,
          today_schedule: employeeData.role !== 1 && todayScheduleDescription,
          today_presence: todayPresence || null,
          member_count: eligibleEmployees,
          total_salary: (journalData && journalData.dataValues.total_salary - depositTotal) || 0,
          withdraw_bill: withdrawBill || 0,
          not_yet_checkin: notYetCheckIn || [],
          not_yet_checkout: notYetCheckOut || [],
          no_schedule: outOfSchedule || [],
          rest_overdue: restOverdue || [],
          home_early: homeEarly || [],
          schedule_to_take: scheduleToTake,
          presence_overdue: presenceOverdue || [],
          overwork: overwork || [],
          approved_withdraw: memberWithdraw || [],
          pending_member: pendingMember !== 0,
          leave_remaining: employeeData.leave,
          bonus_submission: bonusSubmissions,
          pay_gajiandulu_status: employeeData.company.parent_company.pay_gajiandulu_status,
          demo: {
            demo_mode: employeeData.user.demo_mode,
            demo_step: employeeData.user.demo_step,
            disable_step_1: checkEmployee !== null,
            disable_step_2: checkScheduleTemplate !== null || checkDefinedSchedule !== null,
            disable_step_3: checkSalaryGroup !== null
          }
        }
      );
      return res
        .status(200)
        .json(response(true, 'Dashboard summary has been successfully retrieved', payload));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = dashboardService;

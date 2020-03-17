/* eslint-disable indent */
require('module-alias/register');
const {
  response,
  countTotalSchedule,
  dateProcessor: { getRangedDate }
} = require('@helpers');
const Moment = require('moment-timezone');
const {
  sequelize,
  employees: Employee,
  users: User,
  companies: Company,
  presences: Presence,
  journals: Journal,
  journal_details: JournalDetail,
  digital_assets: DigitalAsset,
  company_settings: CompanySetting,
  salary_groups: SalaryGroups,
  division_details: DivisionDetails,
  divisions: Divisions,
  employee_pph21: EmployeePph21,
  ptkp_details: PtkpDetails,
  schedule_shifts: ScheduleShifts,
  cron_members_salary_groups: CronMemberSalaryGroup
} = require('@models');
const Sequelize = require('sequelize');
const { Op } = Sequelize;

/**
 * profileEmployee used to show or update profile of employee by owner or manager
 */
const profileEmployee = {
  getEmployeeInfo: async (req, res) => {
    try {
      const { employeeId } = req.params;
      const employee = await getEmployee(employeeId);
      if (!employee) {
        return res.status(422).json(response(false, 'Employee not found'));
      }
      const employeePayload = {
        id: employee.id,
        role: employee.role,
        date_start_work: employee.date_start_work,
        date_end_work: employee.date_end_work,
        user: {
          id: employee.user.id,
          full_name: employee.user.full_name,
          phone: employee.user.phone,
          email: employee.user.email
        },
        company: {
          id: employee.company.id,
          name: employee.company.name,
          company_name: employee.company.company_name
        },
        employee_pph21s: employee.employee_pph21s
      };

      return res.status(200).json(
        response(true, 'Success get data profil detail', {
          employee: employeePayload
        })
      );
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getPresenceDetail: async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { startDate, endDate } = req.query;
      const employee = await getEmployee(employeeId);
      if (!employee) {
        return res.status(422).json(response(false, 'Employee not found'));
      }
      const presence = await getPresence(employeeId, startDate, endDate);
      if (!presence)
        return res.status(400).json(response(false, 'Data detail presensi tidak ditemukan'));

      const TotalSchedule = await countTotalSchedule(employeeId, startDate, endDate);
      let absence = 0,
        leave = 0,
        holiday = 0,
        permit = 0,
        present = 0,
        presenceOverdueDay = 0,
        presenceOverdueTime = 0,
        homeEarlyDay = 0,
        homeEarlyTime = 0,
        overWorkDay = 0,
        leaveRemaining = employee.leave;
      const presenceList = [];
      for (let i = 0; i < presence.length; i++) {
        let presenceType = '';
        let presenceOverdue = 0,
          homeEarly = 0,
          overwork = 0;

        if (presence[i].is_absence) {
          absence++;
          presenceType = 'Tidak hadir';
        } else if (presence[i].is_leave) {
          leave++;
          presenceType = 'Cuti';
        } else if (presence[i].is_holiday) {
          holiday++;
          presenceType = 'Libur';
        } else if (presence[i].is_permit) {
          permit++;
          presenceType = 'Izin';
        } else {
          present++;
          if (presence[i].presence_overdue !== 0) {
            presenceOverdueDay++;
            presenceOverdueTime += presence[i].presence_overdue;
            presenceOverdue = presence[i].presence_overdue;
          }

          if (presence[i].home_early !== 0) {
            homeEarlyDay++;
            homeEarlyTime += presence[i].home_early;
            homeEarly = presence[i].home_early;
          }

          if (presence[i].overwork !== 0) {
            overWorkDay++;
            overwork = presence[i].overwork;
          }
        }
        const id = presence[i].id;
        const presenceDate = presence[i].presence_date;
        const bonusOrPenalty = await getBonusOrPenalty(employeeId, presenceDate);
        const salary = await getSalary(employeeId, presenceDate);
        const dailySalary = salary ? salary.debet : 0;
        let potonganTotal = 0,
          bonusTotal = 0;

        for (let i = 0; i < bonusOrPenalty.length; i++) {
          if (bonusOrPenalty[i].debet !== 0) {
            bonusTotal += bonusOrPenalty[i].debet;
          } else if (bonusOrPenalty[i].kredit !== 0) {
            potonganTotal += bonusOrPenalty[i].kredit;
          }
        }

        const presenceDetail = {
          id,
          presence_date: presenceDate,
          presence_start: presence[i].presence_start
            ? Moment(presence[i].presence_start)
                .tz(employee.company.timezone)
                .add(-process.env.TIMEZONE_OFFSET, 'hour')
                .format('HH:mm')
            : '-',
          presence_end: presence[i].presence_end
            ? Moment(presence[i].presence_end)
                .tz(employee.company.timezone)
                .add(-process.env.TIMEZONE_OFFSET, 'hour')
                .format('HH:mm')
            : '-',
          presence_type: presenceType,
          presence_overdue: presenceOverdue,
          home_early: homeEarly,
          daily_salary: dailySalary,
          overwork,
          penalty: potonganTotal,
          bonus: bonusTotal
        };

        presenceList.push(presenceDetail);
      }

      const notCheckLog = TotalSchedule - presence.length;
      const presencePayload = {
        absence,
        leave,
        not_check_log: notCheckLog,
        holiday,
        permit,
        present,
        leave_remaining: leaveRemaining
      };

      const diciplinePayload = {
        presence_overdue_day: presenceOverdueDay,
        presence_overdue_time: presenceOverdueTime,
        home_early_day: homeEarlyDay,
        home_early_time: homeEarlyTime,
        over_work_day: overWorkDay
      };
      return res.status(200).json(
        response(true, 'Success get data presence detail', {
          user: {
            user_id: employee.user.id,
            employee_id: employee.id,
            full_name: employee.user.full_name,
            role: employee.role,
            active: employee.active,
            avatar: employee.assets.length ? employee.assets[0].url : null,
            deleted_at: getRangedDate(employee.company.setting.payroll_date).dateEnd
          },
          presence_payload: presencePayload,
          dicipline_payload: diciplinePayload,
          presence_list: presenceList
        })
      );
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getEmployeeSalary: async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { startDate, endDate } = req.query;
      const employee = await getEmployee(employeeId);
      if (!employee) {
        return res.status(422).json(response(false, 'Employee not found'));
      }
      const journals = await getAllJournals(employeeId, startDate, endDate);
      if (!journals) return res.status(400).json(response(false, 'journal tidak ditemukan'));
      const checkCron = await CronMemberSalaryGroup.findOne({ where: { employee_id: employeeId } });
      const payrollDate = getRangedDate(employee.company.setting.payroll_date);

      let withdraw = 0;
      let changeSalary = null;
      let monthlySalary = [],
        shiftSalary = [],
        bonus = [],
        penalty = [];

      if (checkCron) {
        if (checkCron.salary_id) {
          changeSalary = {
            type: 1,
            change_date: payrollDate.dateEnd
          };
        } else {
          changeSalary = {
            type: 2,
            change_date: payrollDate.dateEnd
          };
        }
      }

      for (let i = 0; i < journals.length; i++) {
        if (
          journals[i].salary_group &&
          journals[i].type === 'salary' &&
          journals[i].salary_group.salary_type === '1'
        ) {
          const debet = journals[i].debet ? journals[i].debet : 0;
          const monthlyPayload = {
            employee_id: journals[i].employee_id,
            type: journals[i].type,
            current_salary: debet,
            salary_groups_id: journals[i].salary_group.id,
            salary_name: journals[i].salary_group.salary_name,
            salary_type: journals[i].salary_group.salary_type,
            salary: journals[i].salary_group.salary
          };

          let isUnique = true;
          for (let x = 0; x < monthlySalary.length; x++) {
            if (monthlySalary[x].salary_groups_id === monthlyPayload.salary_groups_id) {
              monthlySalary[x].current_salary += monthlyPayload.current_salary;
              isUnique = false;
            }
          }

          if (isUnique) {
            monthlySalary.push(monthlyPayload);
          }
        }

        if (
          journals[i].salary_group &&
          journals[i].type === 'salary' &&
          journals[i].salary_group.salary_type === '2'
        ) {
          const debet = journals[i].debet ? journals[i].debet : 0;
          let shiftName = '',
            startTime = 0,
            endTime = 0;
          if (journals[i].salary_group.schedule_shift) {
            shiftName = journals[i].salary_group.schedule_shift.shift_name;
            startTime = journals[i].salary_group.schedule_shift.start_time;
            endTime = journals[i].salary_group.schedule_shift.end_time;
          }
          const shiftPayload = {
            employee_id: journals[i].employee_id,
            type: journals[i].type,
            current_salary: debet,
            salary_group_id: journals[i].salary_group.id,
            salary_name: journals[i].salary_group.salary_name,
            salary_type: journals[i].salary_group.salary_type,
            salary: journals[i].salary_group.salary,
            shift_name: shiftName,
            start_time: startTime,
            end_time: endTime
          };
          let isUnique = true;
          for (let x = 0; x < shiftSalary.length; x++) {
            if (shiftSalary[x].salary_group_id === shiftPayload.salary_group_id) {
              shiftSalary[x].current_salary += shiftPayload.current_salary;
              isUnique = false;
            }
          }
          if (isUnique) {
            shiftSalary.push(shiftPayload);
          }
        }

        if (
          journals[i].type === 'other' &&
          journals[i].debet !== 0 &&
          (journals[i].kredit === 0 || !journals[i].kredit)
        ) {
          const bonusPayload = {
            created_at: journals[i].created_at,
            amount: journals[i].debet,
            note: journals[i].description
          };
          bonus.push(bonusPayload);
        }

        if (
          journals[i].type === 'other' &&
          (journals[i].debet === 0 || !journals[i].debet) &&
          journals[i].kredit !== 0
        ) {
          const penaltyPayload = {
            created_at: journals[i].created_at,
            amount: journals[i].kredit,
            note: journals[i].description
          };
          penalty.push(penaltyPayload);
        }

        if (journals[i].journal_detail && journals[i].type === 'withdraw') {
          if (journals[i].journal_detail.status === 1) {
            withdraw += journals[i].journal_detail.total;
          }
        }
      }

      return res.status(200).json(
        response(true, 'Success get salary data of employee', {
          monthly_salary: monthlySalary,
          shift_salary: shiftSalary,
          bonus,
          penalty,
          gajian_dulu: withdraw,
          salary_group: employee.salary_groups.length ? employee.salary_groups[0] : null,
          change_salary: changeSalary
        })
      );
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getEmployeeJournal: async (req, res) => {
    try {
      const journal = await getJournal(req.params.employeeId, req.query.presence_date);
      return res
        .status(200)
        .json(response(true, 'Success get data journal of employee', { journal }));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  updatePersonalInfo: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const { data } = req.body;
      const { employeeId } = req.params;

      // find employee
      const employee = await Employee.find({ where: { id: employeeId } });
      if (!employee) {
        return res.status(422).json(response(false, 'Employee not found'));
      }

      // update user
      await User.update(data.user, {
        where: { id: employee.dataValues.user_id },
        transaction
      });

      // update company
      await Company.update(data.company, {
        where: { id: employee.dataValues.company_id },
        transaction
      });

      // update employee
      await employee.update(data.employee, { transaction });

      // update employeepph21
      const employeepph21 = await EmployeePph21.find({
        where: { employee_id: employee.dataValues.id }
      });
      await employeepph21.update(data.pph21, {
        transaction
      });

      // update ptkp
      await PtkpDetails.update(data.ptkp, {
        where: { id: employeepph21.dataValues.ptkp_detail_id },
        transaction
      });

      await transaction.commit();
      return res.status(200).json(response(true, 'Success update personal info employee'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  updateEmployeeJournal: async (req, res) => {
    try {
      const { data } = req.body;
      const { employeeId } = req.params;
      const { presence_date } = req.query;
      const journal = await getJournal(employeeId, presence_date);
      if (!journal) {
        return res.status(422).json(response(false, 'Journal not found'));
      }
      await journal.update(data.journal);
      return res
        .status(200)
        .json(response(true, 'Success update journal info employee', { journal }));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  deleteEmployee: async (req, res) => {
    try {
      const { employeeId } = req.params;
      const nowDate = new Date().getDate();
      const nowMonth = new Date().getMonth();
      const nowYear = new Date().getFullYear();
      let dateEnd;

      // find employee
      const employee = await Employee.find({
        where: { id: employeeId },
        include: [
          {
            model: Company,
            attributes: ['id'],
            include: [{ model: CompanySetting, as: 'setting', attributes: ['payroll_date'] }]
          }
        ]
      });
      if (!employee) {
        return res.status(422).json(response(false, 'Employee not found'));
      }

      // due date the employee will be destroyed
      let { payroll_date } = employee.company.setting;
      if (payroll_date != 0) {
        if (payroll_date <= nowDate) {
          if (nowYear == 12) {
            let date = payroll_date;
            let month = 1;
            let year = nowYear + 1;
            dateEnd = new Date(`${year}-${month}-${date}`);
          } else {
            let date = payroll_date;
            let month = nowMonth + 2;
            let year = nowYear;
            dateEnd = new Date(`${year}-${month}-${date}`);
          }
        } else {
          dateEnd = new Date(`${nowYear}-${nowMonth}-${payroll_date}`);
        }
      } else {
        dateEnd = new Date(nowYear, nowMonth + 1, 0, 23, 59, 59);
        if (dateEnd.getDate() == nowDate) {
          dateEnd = new Date(nowYear, nowMonth + 1 + 1, 0, 23, 59, 59);
        }
      }

      // update table employee
      await employee.update({ active: 0 });

      return res.status(200).json(
        response(true, 'Employee will be deleted in next payroll date', {
          end_date: dateEnd
        })
      );
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = profileEmployee;

const getEmployee = async idEmployee => {
  const employee = await Employee.findOne({
    where: { id: idEmployee },
    include: [
      {
        model: User,
        attributes: ['id', 'full_name', 'email', 'phone']
      },
      {
        model: Company,
        include: [{ model: CompanySetting, as: 'setting' }]
      },
      {
        model: SalaryGroups,
        attributes: ['id', 'salary_name', 'salary_type', 'salary']
      },
      { model: DivisionDetails, include: { model: Divisions } },
      {
        model: DigitalAsset,
        required: false,
        attributes: ['url', 'type'],
        where: {
          type: 'avatar'
        },
        as: 'assets'
      },
      {
        model: EmployeePph21,
        attributes: ['id', 'ptkp_detail_id', 'position_allowance', 'npwp'],
        include: { model: PtkpDetails, attributes: ['ptkp_id', 'name'] }
      }
    ]
  });
  return employee;
};

const getPresence = async (idEmployee, dateFrom, dateEnd) => {
  const presence = await Presence.findAll({
    where: {
      employee_id: idEmployee,
      presence_date: {
        [Op.between]: [dateFrom, dateEnd]
      }
    }
  });
  return presence;
};

const getAllJournals = async (idEmployee, dateFrom, dateEnd) => {
  const journals = await Journal.findAll({
    where: [
      Sequelize.where(
        Sequelize.fn('DATE_FORMAT', Sequelize.col('journals.created_at'), '%Y-%m-%d'),
        '>=',
        dateFrom
      ),
      Sequelize.where(
        Sequelize.fn('DATE_FORMAT', Sequelize.col('journals.created_at'), '%Y-%m-%d'),
        '<=',
        dateEnd
      ),
      {
        employee_id: idEmployee
      }
    ],
    include: [
      {
        model: SalaryGroups,
        include: [
          {
            model: ScheduleShifts
          }
        ]
      },
      {
        model: JournalDetail
      }
    ]
  });
  return journals;
};

const getJournal = async (idEmployee, presenceDate) => {
  const start = new Date(presenceDate);

  const journal = await Journal.findOne({
    where: { employee_id: idEmployee, created_at: start },
    include: [
      {
        model: JournalDetail
      }
    ]
  });

  return journal;
};

const getBonusOrPenalty = async (idEmployee, presenceDate) => {
  const start = new Date(presenceDate);

  const bonusOrPenalty = await Journal.findAll({
    where: { employee_id: idEmployee, created_at: start, type: 'other' },
    include: [
      {
        model: JournalDetail
      }
    ]
  });
  return bonusOrPenalty;
};

const getSalary = async (idEmployee, presenceDate) => {
  const salary = await Journal.findOne({
    where: [
      { employee_id: idEmployee, type: 'salary' },
      Sequelize.where(
        Sequelize.fn('DATE_FORMAT', Sequelize.col('journals.created_at'), '%Y-%m-%d'),
        presenceDate
      )
    ],
    include: [
      {
        model: JournalDetail
      }
    ]
  });
  return salary;
};

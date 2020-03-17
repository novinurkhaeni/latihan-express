/* eslint-disable indent */
require('module-alias/register');
const Sequelize = require('sequelize');
const Moment = require('moment-timezone');
const { Op } = Sequelize;
const Excel = require('exceljs');
const fs = require('fs');
const {
  response,
  presenceOverdueCheck,
  nodemailerMail,
  mailTemplates,
  dateConverter
} = require('@helpers');
const {
  sequelize,
  digital_assets: DigitalAsset,
  employees: Employee,
  users: User,
  presences: Presence,
  employee_notes: EmployeeNote,
  journals: Journal,
  journal_details: JournalDetails,
  companies: Company,
  company_settings: CompanySetting,
  division_details: DivisionDetails,
  divisions: Divisions
} = require('@models');
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const presenceService = {
  /*
   * Get detail presence data
   *
   */
  get: async (req, res) => {
    const { company_id, presence_id } = req.params;
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
            where: { company_id: company_id },
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
          { model: Company, attributes: ['name', 'company_name', 'timezone'] }
        ]
      });

      let totalSalary = 0;
      let totalBonus = 0;
      let totalPenalty = 0;
      for (let i = 0; i < presences.employee.journals.length; i++) {
        if (presences.employee.journals[i].type.toString() === 'salary') {
          totalSalary += presences.employee.journals[i].debet;
        }
        if (presences.employee.journals[i].type.toString() !== 'salary') {
          totalBonus += presences.employee.journals[i].debet;
          totalPenalty += presences.employee.journals[i].kredit;
        }
      }

      totalSalary = totalSalary + totalBonus - totalPenalty;

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
        work_hours: presences.work_hours,
        salary: totalSalary,
        bonus: totalBonus,
        penalty: totalPenalty,
        presence_assets: presences.assets,
        notes: presences.employee.employee_notes,
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
   * Get complete presence data of company in specific date
   *
   */
  find: async (req, res) => {
    const { company_id: companyId } = req.params;
    const presence_date = req.query.date;
    const { employeeRole, employeeId } = res.local.users;
    try {
      const companyIdArray = companyId.split(',');
      let presences;
      if (employeeRole.toString() === '2') {
        presences = await Presence.findAll({
          where: { presence_date: req.query.date, employee_id: employeeId, custom_presence: 0 },
          include: [
            {
              model: Employee,
              where: { company_id: companyIdArray },
              include: [
                {
                  model: User
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
                { model: Company, attributes: ['timezone'] }
              ]
            },
            { model: Company, attributes: ['name', 'company_name'] }
          ]
        });
      } else {
        presences = await Presence.findAll({
          where: { presence_date: req.query.date, custom_presence: 0 },
          include: [
            {
              model: Employee,
              where: { company_id: companyIdArray, active: 1 },
              include: [
                {
                  model: User
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
                { model: Company, attributes: ['timezone'] }
              ]
            },
            { model: Company, attributes: ['name', 'company_name'] }
          ]
        });
      }
      let presenceList = [];
      presences.map(data => {
        let result = Object.assign({
          id: data.id,
          presence_date: data.presence_date,
          presence_start: data.presence_start
            ? Moment(data.presence_start)
                .tz(data.employee.company.timezone)
                .add(-process.env.TIMEZONE_OFFSET, 'hour')
                .format('HH:mm')
            : '-',
          presence_end: data.presence_end
            ? Moment(data.presence_end)
                .tz(data.employee.company.timezone)
                .add(-process.env.TIMEZONE_OFFSET, 'hour')
                .format('HH:mm')
            : '-',
          rest_start: data.rest_start,
          rest_end: data.rest_end,
          presence_overdue: data.presence_overdue,
          rest_overdue: data.rest_overdue,
          is_absence: data.is_absence,
          is_leave: data.is_leave,
          is_holiday: data.is_holiday,
          is_permit: data.is_permit,
          is_custom_ceklok: data.is_custom_presence === 1,
          overwork: data.overwork,
          work_hours: data.work_hours,
          home_early: data.home_early,
          employee: {
            id: data.employee.id,
            role: data.employee.role,
            full_name: data.employee.user.full_name,
            email: data.employee.user.email,
            phone: data.employee.user.phone,
            assets: data.employee.assets
          },
          company: data.company
        });
        presenceList.push(result);
      });
      if (!presences) {
        return res
          .status(400)
          .json(response(false, `Presences list with id ${presence_date} not found`));
      }
      presenceList.sort((prev, next) => {
        // Sort By Presence Start ASC
        if (prev.presence_start > next.presence_start) return -1;
        if (prev.presence_start < next.presence_start) return 1;
        // Sort By Name ASC
        if (prev.employee.full_name > next.employee.full_name) return -1;
        if (prev.employee.full_name < next.employee.full_name) return 1;
      });
      return res
        .status(200)
        .json(response(true, 'Presences list retrieved successfully', presenceList));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  /*
   * Edit presence data
   *
   */
  patch: async (req, res) => {
    const { presence_id: presenceId } = req.params;
    const { data } = req.body;
    try {
      let presences = await Presence.findOne({
        where: { id: presenceId },
        include: { model: Employee }
      });
      if (!presences) {
        return res.status(400).json(response(false, 'Wrong id of presence, data not available'));
      }

      const employeeData = await Employee.findOne({
        where: { user_id: presences.employee.user_id },
        include: [
          {
            model: Company,
            include: [{ model: CompanySetting, as: 'setting' }]
          }
        ]
      });

      let work_hours;
      let overwork;
      let rest_overdue;

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

        const presenceOverdue = await presenceOverdueCheck(
          new Date(`${presenceStart ? presenceStart : presences.presence_start}`),
          employeeData.id
        );

        if (presences.presence_end) {
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
        if (presences.presence_end) {
          const payloadJournal = {
            employee_id: employeeData.id,
            type: 'salary',
            debet: employeeData.daily_salary_with_meal
              ? employeeData.daily_salary_with_meal
              : employeeData.daily_salary,
            kredit: 0,
            description: `Gaji harian tanggal ${presences.presence_date}`,
            created_at: new Date(presences.presence_date),
            updated_at: new Date(presences.presence_date)
          };

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

      presences = await Presence.update(payload, { where: { id: presenceId } });
      if (!presences) {
        return res.status(400).json(response(false, 'Presence data not updated'));
      }
      presences = await Presence.findOne({ where: { id: presenceId } });
      return res
        .status(200)
        .json(response(true, 'Presence data has been successfully updated', presences));
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
  create: async (req, res) => {
    const { data } = req.body;
    const { member: employeeId, date } = req.query;
    const presenceStart = new Date(`${data.presence_start} +0700`);
    const presenceEnd = new Date(`${data.presence_end} +0700`);
    const restStart = data.rest_start ? new Date(`${data.rest_start} +0700`) : null;
    const restEnd = data.rest_end ? new Date(`${data.rest_end} +0700`) : null;
    let presence;
    let notes;

    try {
      const employeeData = await Employee.findOne({
        where: { id: employeeId },
        include: [
          {
            model: Company,
            include: [{ model: CompanySetting, as: 'setting' }]
          }
        ]
      });

      if (!employeeData) {
        return res.status(400).json(response(false, 'Data anggota tidak ditemukan'));
      }

      presence = await Presence.findOne({
        where: { employee_id: employeeId, presence_date: date }
      });

      if (presence) {
        return res
          .status(400)
          .json(response(false, 'Anggota yang anda pilih hari ini sudah melakukan presensi'));
      }

      /*
       *  IF there absence or leaving
       */
      if (req.query.type) {
        if (req.query.type === 'leave') {
          presence = await Presence.create({
            is_leave: true,
            employee_id: employeeData.id,
            presence_date: date
          });

          const journal = await Journal.create({
            employee_id: employeeData.id,
            type: 'salary',
            debet: employeeData.daily_salary,
            kredit: 0,
            description: `Gaji cuti tanggal ${date}`,
            created_at: new Date(date),
            updated_at: new Date(date)
          });

          if (!journal) {
            return res
              .status(400)
              .json(response(false, 'Gagal mencatat presensi ke jurnal keuangan'));
          }

          return res.status(200).json(response(true, 'Berhasil membuat cuti presensi manual'));
        } else if (req.query.type === 'absence') {
          presence = await Presence.create({
            is_absence: true,
            employee_id: employeeData.id,
            presence_date: date
          });

          return res
            .status(200)
            .json(response(true, 'Berhasil membuat tidak masuk presensi manual'));
        } else {
          return res.status(422).json(response(false, 'Wrong type request'));
        }
      }

      /*
       *  Check presence overdue
       */
      const presenceOverdue = await presenceOverdueCheck(
        new Date(`${presenceStart} -0700`),
        employeeData.id
      );

      const workHours = Math.abs(presenceStart - presenceEnd) / 36e5;
      let overWorked = workHours - employeeData.company.setting.overwork_limit;
      let overwork = overWorked < 0 ? 0 : overWorked;

      let payloadPresence = {
        employee_id: employeeData.id,
        presence_date: date,
        presence_start: presenceStart,
        presence_end: presenceEnd,
        checkin_location: employeeData.company.location,
        checkout_location: employeeData.company.location,
        overwork: overwork,
        work_hours: workHours.toFixed(2)
      };

      if (
        parseInt(presenceOverdue) > parseInt(employeeData.company.setting.presence_overdue_limit)
      ) {
        // Insert presence overdue if beyond threshold
        payloadPresence.presence_overdue =
          presenceOverdue - employeeData.company.setting.presence_overdue_limit;
      }

      /*
       *  Check rest overdue
       */
      let restOverdueCal = -1;

      if (restStart && restEnd) {
        const totalRest = Math.floor(Math.abs(restEnd - restStart) / (1000 * 60)); // minutes
        const totalRestHour = Math.abs(restEnd - restStart) / 36e5; // hour
        restOverdueCal = Math.floor(totalRest - employeeData.company.setting.rest_limit);
        overWorked = workHours - totalRestHour - employeeData.company.setting.overwork_limit;
        overwork = overWorked < 0 ? 0 : overWorked;
        payloadPresence.work_hours = (workHours - totalRestHour).toFixed(2);
        payloadPresence.overwork = overwork;
      }

      const restOverdue = restOverdueCal < 0 ? 0 : restOverdueCal;

      payloadPresence.rest_start = restStart;
      payloadPresence.rest_end = restEnd;
      payloadPresence.rest_overdue = restOverdue;

      /*
       *  payload Journal
       */
      const payloadJournal = [
        {
          employee_id: employeeData.id,
          type: 'salary',
          debet: employeeData.daily_salary_with_meal
            ? employeeData.daily_salary_with_meal
            : employeeData.daily_salary,
          kredit: 0,
          description: `Gaji harian tanggal ${date}`,
          created_at: new Date(date),
          updated_at: new Date(date)
        }
      ];

      if (data.bonus) {
        payloadJournal.push({
          employee_id: employeeData.id,
          type: 'other',
          debet: data.bonus,
          kredit: 0,
          description: `Bonus tanggal ${date}`,
          created_at: new Date(date),
          updated_at: new Date(date)
        });
      }

      if (data.penalty) {
        payloadJournal.push({
          employee_id: employeeData.id,
          type: 'other',
          debet: 0,
          kredit: data.penalty,
          description: `Denda tanggal ${date}`,
          created_at: new Date(date),
          updated_at: new Date(date)
        });
      }

      /*
       * Let's insert the data
       */

      presence = await Presence.create(payloadPresence);

      if (!presence) {
        return res.status(400).json(response(false, 'Gagal membuat presensi manual'));
      }

      const journal = await Journal.bulkCreate(payloadJournal);

      if (!journal) {
        return res.status(400).json(response(false, 'Gagal mencatat presensi ke jurnal keuangan'));
      }

      if (data.notes) {
        notes = await EmployeeNote.create({
          employee_id: employeeData.id,
          date: date,
          notes: data.notes,
          created_at: new Date(date),
          updated_at: new Date(date)
        });

        if (!notes) {
          return res.status(400).json(response(false, 'Gagal membuat catatan presensi'));
        }
      }

      return res.status(200).json(response(true, 'Berhasil membuat presensi manual'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  /*
   * Delete presence data
   *
   */
  delete: async (req, res) => {
    const { presence_id } = req.params;
    const { type } = req.query;
    const { id, employeeId } = res.local.users;
    let presence;
    const today = dateConverter(new Date());
    const transaction = sequelize.transaction();
    try {
      const presenceId = presence_id.split(',');
      presence = await Presence.findAll({
        where: { id: presenceId },
        include: { model: Employee, include: { model: User, attributes: ['full_name'] } }
      });
      if (!presence.length) {
        return res.status(400).json(response(false, 'Tidak ditemukan data presensi'));
      }
      const employeeIds = [];
      let memberNames = [];
      const presenceDate = presence[0].presence_date;

      if (today > presenceDate) {
        return res
          .status(400)
          .json(response(false, 'Tidak bisa menghapus kehadiran yang telah berlalu'));
      }

      presence.forEach(val => {
        employeeIds.push(val.employee_id.toString());
        memberNames.push(val.employee.user.full_name);
      });
      memberNames = memberNames.toString().replace(/,/g, ', ');
      await Journal.destroy(
        {
          where: [
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
              type === undefined || type === '1' ? '=' : '>=',
              presenceDate
            ),
            {
              employee_id: employeeIds,
              type: { [Op.notIn]: ['withdraw', 'subscribe', 'payment'] }
            }
          ]
        },
        { transaction }
      );
      if (type === undefined || type === '1') {
        await EmployeeNote.destroy(
          { where: { employee_id: employeeIds, date: presenceDate } },
          { transaction }
        );
        presence = await Presence.destroy(
          {
            where: { employee_id: employeeIds, id: presenceId },
            cascade: true
          },
          { transaction }
        );
      } else {
        await EmployeeNote.destroy(
          {
            where: { employee_id: employeeIds, date: { [Op.gte]: presenceDate } }
          },
          { transaction }
        );
        presence = await Presence.destroy(
          {
            where: { employee_id: employeeIds, presence_date: { [Op.gte]: presenceDate } },
            cascade: true
          },
          { transaction }
        );
      }
      if (!presence) {
        return res.status(400).json(response(false, 'Tidak ada yang terhapus'));
      }
      // SEND ACTIVITY NOTIFICATION
      const checkUser = await User.findOne({ where: { id } });
      const description = `${checkUser.full_name} telah menghapus data presensi untuk anggota ${memberNames}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });

      return res.status(200).json(response(true, 'Berhasil menghapus presensi'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  /*
   * Export presence data of company in a month
   * Then send it to email of requester
   */
  export: async (req, res) => {
    const { company_id } = req.params;
    const { month, year, dateStart, dateEnd } = req.query;
    let start = dateStart;
    let end = dateEnd;
    if (!dateStart && !dateEnd) {
      const totalDays = new Date(
        new Date(year, month).getFullYear(),
        new Date(year, month).getMonth() + 1,
        0
      ).getDate();
      const rawDateStart = new Date(year, month - 1);
      const rawDateEnd = new Date(new Date(year, month - 1).setDate(totalDays));
      start = `${rawDateStart.getFullYear()}-${rawDateStart.getMonth() +
        1}-${rawDateStart.getDate()}`;
      end = `${rawDateEnd.getFullYear()}-${rawDateEnd.getMonth() + 1}-${rawDateEnd.getDate()}`;
    }
    try {
      if (res.local.users.employeeRole === 2) {
        return res
          .status(403)
          .json(response(false, 'Hanya manajer yang dapat meminta data presensi'));
      }

      const companyData = await Company.findOne({
        where: { id: company_id }
      });

      // Find Manager's Email
      const managerEmail = await User.findOne({
        where: { id: res.local.users.id },
        attributes: ['email']
      });

      if (!companyData) {
        return res.status(400).json(response(false, 'Company not found'));
      }

      const presencesData = await Employee.findAll({
        where: { company_id: company_id },
        include: [
          { model: User },
          {
            model: Presence,
            where: {
              presence_date: {
                $between: [start, end]
              }
            },
            order: [['presence_date', 'ASC']]
          }
        ]
      });

      let workbook = new Excel.Workbook();
      workbook.creator = 'GajianDulu';
      workbook.created = new Date();
      workbook.modified = new Date();

      let worksheet = workbook.addWorksheet('Data Prensensi');

      for (let s = 1; s <= 16; s++) {
        worksheet.getColumn(s).width = 35;
        if (s % 2 === 1) {
          worksheet.getColumn(s).width = 25;
        }
      }

      for (let i = 0; i <= presencesData.length - 1; i++) {
        const presenceHeaderTable = [
          'No',
          'Tanggal Presensi',
          'Absen',
          'Cuti',
          'Waktu Masuk',
          'Waktu Keluar',
          'Istirahat Mulai',
          'Istirahat Selesai',
          'Keterlambatan Masuk',
          'Keterlambatan Istirahat',
          'Lembur',
          'Total Jam Kerja',
          'Catatan',
          'Bonus',
          'Denda',
          'Upah Hari Ini'
        ];

        let totalPresenceOverdue = 0;
        let totalAbsence = 0;
        let totalOverwork = 0;
        let totalLeave = 0;
        let totalBonus = 0;
        let totalPenalty = 0;
        let totalSalary = 0;
        let totalWithdraw = 0;
        let totalTransferedSalary = 0;
        let grossWithdraws = 0;
        let debit = 0;
        let credit = 0;
        for (let s = 0; s <= presencesData[i].presences.length - 1; s++) {
          totalOverwork += presencesData[i].presences[s].overwork;
          totalLeave += presencesData[i].presences[s].is_leave;
          totalPresenceOverdue += presencesData[i].presences[s].presence_overdue;
          totalAbsence += presencesData[i].presences[s].is_absence;
        }
        // Find and Count Total Transfered Salary
        const journalData = await Journal.findAll({
          where: [
            {
              $not: {
                type: 'withdraw'
              }
            },
            { employee_id: presencesData[i].id },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m'),
              `${year}-${month}`
            )
          ],
          attributes: ['type', 'debet', 'kredit', 'description', 'created_at']
        });

        journalData.map(del => {
          debit += del.debet;
          credit += del.kredit;
        });

        totalTransferedSalary = debit - credit;

        // Find and Count Total Withdraw
        const withdrawData = await JournalDetails.findAll({
          include: {
            model: Journal,
            attributes: ['type', 'employee_id', 'description'],
            where: [
              { employee_id: presencesData[i].id, type: 'withdraw' },
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

        if (withdrawData.length > 0) {
          for (let i = 0; i < withdrawData.length; i++) {
            if (withdrawData[i].status.toString() === '1') {
              totalWithdraw += withdrawData[i].total;
            }
            if (withdrawData[i].status.toString() !== '-1') {
              grossWithdraws += withdrawData[i].total;
            }
          }
        }
        totalTransferedSalary = totalTransferedSalary - grossWithdraws;

        // Find and Count Bonus and Fine
        const journal = await Journal.findAll({
          where: [
            { employee_id: presencesData[i].id },
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
          ]
        });
        for (let d = 0; d < journal.length; d++) {
          if (journal[d].type.toString() === 'salary') {
            totalSalary += journal[d].debet;
          }
          if (journal[d].type.toString() !== 'salary') {
            totalBonus += journal[d].debet;
            totalPenalty += journal[d].kredit;
          }
        }
        totalSalary = totalSalary + totalBonus - totalPenalty;
        const firstHeaderContent = [
          'Nama lengkap :',
          presencesData[i].user.full_name,
          'No. Telepon :',
          presencesData[i].user.phone,
          'Gaji Bulanan :',
          `Rp ${presencesData[i].salary.toFixed().replace(/(\d)(?=(\d{3})+(,|$))/g, '$1.')}`,
          'Peran :',
          presencesData[i].role === 1 ? 'Manajer' : 'Anggota',
          'Total Terlambat :',
          `${totalPresenceOverdue.toFixed().replace(/(\d)(?=(\d{3})+(,|$))/g, '$1.')} Menit`,
          'Total Absen :',
          `${totalAbsence} Hari`,
          'Total Denda :',
          `(Rp. ${totalPenalty.toFixed().replace(/(\d)(?=(\d{3})+(,|$))/g, '$1.')})`,
          'Total Upah yang Didapat :',
          `Rp. ${totalSalary.toFixed().replace(/(\d)(?=(\d{3})+(,|$))/g, '$1.')}`
        ];

        const secondHeaderContent = [
          'Periode :',
          `${start} s/d ${end}`,
          'Email :',
          presencesData[i].user.email,
          'Hari Kerja Sebulan :',
          `${presencesData[i].workdays} Hari`,
          'Total Lembur :',
          `${totalOverwork} Jam`,
          'Total Cuti :',
          `${totalLeave} Hari`,
          'Total Bonus :',
          `Rp. ${totalBonus.toFixed().replace(/(\d)(?=(\d{3})+(,|$))/g, '$1.')}`,
          'Total Tarikan GajianDulu :',
          `Rp. ${totalWithdraw.toFixed().replace(/(\d)(?=(\d{3})+(,|$))/g, '$1.')}`,
          'Total Gaji Yang Ditransfer :',
          `Rp. ${totalTransferedSalary.toFixed().replace(/(\d)(?=(\d{3})+(,|$))/g, '$1.')}`
        ];

        worksheet.addRows([firstHeaderContent, secondHeaderContent]);
        worksheet.getRow(worksheet.lastRow._number + 1).addPageBreak();
        worksheet.addRow(presenceHeaderTable).font = { color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(worksheet.lastRow._number).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF999999' }
        };

        for (let l = 0; l < presencesData[i].presences.length; l++) {
          // Find Daily Presence Note
          const notes = await EmployeeNote.findOne({
            where: {
              employee_id: presencesData[i].id,
              date: presencesData[i].presences[l].presence_date
            }
          });

          // Find Bonus and Fine
          const journal = await Journal.findAll({
            where: [
              Sequelize.where(
                Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y%c%d'),
                Sequelize.fn('DATE_FORMAT', presencesData[i].presences[l].presence_date, '%Y%c%d')
              ),
              { employee_id: presencesData[i].id }
            ]
          });

          let bonus = 0;
          let penalty = 0;
          let salary = 0;

          for (let i = 0; i < journal.length; i++) {
            if (journal[i].type.toString() === 'salary') {
              salary += journal[i].debet;
            }
            if (journal[i].type.toString() !== 'salary') {
              bonus += journal[i].debet;
              penalty += journal[i].kredit;
            }
          }

          salary = salary + bonus - penalty;

          let presenceStart =
            presencesData[i].presences[l].presence_start &&
            new Date(presencesData[i].presences[l].presence_start);
          let presenceEnd =
            presencesData[i].presences[l].presence_end &&
            new Date(presencesData[i].presences[l].presence_end);
          let restStart =
            presencesData[i].presences[l].rest_start &&
            new Date(presencesData[i].presences[l].rest_start);
          let restEnd =
            presencesData[i].presences[l].rest_start &&
            new Date(presencesData[i].presences[l].rest_end);

          /* eslint-disable */
          presenceStart = presenceStart
            ? `${
                presenceStart.getHours().toString().length === 1
                  ? '0' + presenceStart.getHours()
                  : presenceStart.getHours()
              }:${
                presenceStart.getMinutes().toString().length === 1
                  ? '0' + presenceStart.getMinutes()
                  : presenceStart.getMinutes()
              }`
            : '-';

          presenceEnd = presenceEnd
            ? `${
                presenceEnd.getHours().toString().length === 1
                  ? '0' + presenceEnd.getHours()
                  : presenceEnd.getHours()
              }:${
                presenceEnd.getMinutes().toString().length === 1
                  ? '0' + presenceEnd.getMinutes()
                  : presenceEnd.getMinutes()
              }`
            : '-';

          restStart = restStart
            ? `${
                restStart.getHours().toString().length === 1
                  ? '0' + restStart.getHours()
                  : restStart.getHours()
              }:${
                restStart.getMinutes().toString().length === 1
                  ? '0' + restStart.getMinutes()
                  : restStart.getMinutes()
              }`
            : '-';

          restEnd = restEnd
            ? `${
                restEnd.getHours().toString().length === 1
                  ? '0' + restEnd.getHours()
                  : restEnd.getHours()
              }:${
                restEnd.getMinutes().toString().length === 1
                  ? '0' + restEnd.getMinutes()
                  : restEnd.getMinutes()
              }`
            : '-';
          /* eslint-enabled */

          const valueRow = [
            (l + 1).toString(),
            presencesData[i].presences[l].presence_date,
            presencesData[i].presences[l].is_absence ? 'Ya' : 'Tidak',
            presencesData[i].presences[l].is_leave ? 'Ya' : 'Tidak',
            presenceStart,
            presenceEnd,
            restStart,
            restEnd,
            presencesData[i].presences[l].presence_overdue
              ? `${presencesData[i].presences[l].presence_overdue} Menit`
              : '-',
            presencesData[i].presences[l].rest_overdue
              ? `${presencesData[i].presences[l].rest_overdue} Menit`
              : '-',
            presencesData[i].presences[l].overwork
              ? `${presencesData[i].presences[l].overwork} Jam`
              : '-',
            presencesData[i].presences[l].work_hours
              ? `${presencesData[i].presences[l].work_hours} Jam`
              : '-',
            notes ? notes.notes : 'Tidak ada catatan',
            `Rp. ${bonus.toFixed().replace(/(\d)(?=(\d{3})+(,|$))/g, '$1.')}`,
            `(Rp. ${penalty.toFixed().replace(/(\d)(?=(\d{3})+(,|$))/g, '$1.')})`,
            `Rp. ${salary.toFixed().replace(/(\d)(?=(\d{3})+(,|$))/g, '$1.')}`
          ];
          worksheet.addRow(valueRow).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: l % 2 === 0 ? 'FFFFFFFF' : 'FFD1D1D1' }
          };
        }

        worksheet.getRow(worksheet.lastRow._number + 1).addPageBreak();
      }
      await workbook.xlsx.writeFile(`Presensi-${companyData.codename}-${start}sd${end}.xlsx`);
      /* eslint-disable indent */
      await nodemailerMail.sendMail(
        {
          from: 'cs@atenda.id',
          to: managerEmail.email, // An array if you have multiple recipients.
          subject: `Data Presensi Periode ${start} s/d ${end} - ${companyData.name} - Atenda`,
          //You can use 'html:' to send HTML email content. It's magic!
          html: mailTemplates.presencesXls({ companyData, start, end }),
          attachments: [
            {
              filename: `Presensi-${companyData.codename}-${start}sd${end}.xlsx`,
              path: `Presensi-${companyData.codename}-${start}sd${end}.xlsx`
            }
          ]
        },
        function(err, info) {
          if (err) {
            fs.unlink(`Presensi-${companyData.codename}-${start}sd${end}.xlsx`);
            let errorLog = new Date().toISOString() + ' [Export Presence XLS]: ' + err + '\n';
            global.emailErrorLog.write(errorLog);
            return res
              .status(400)
              .json(response(false, 'Coba Lagi, Gagal Mengirim Data Presensi', err));
          } else {
            fs.unlink(`Presensi-${companyData.codename}-${start}sd${end}.xlsx`);
            return res.status(200).json(response(true, 'Data Presensi Telah dikirim'));
          }
        }
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

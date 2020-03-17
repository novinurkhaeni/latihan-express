require('module-alias/register');
const Excel = require('exceljs');
const Sequelize = require('sequelize');
const {
  response,
  compareCoordinates,
  scheduleTemplates: scheduleTemplatesHelper,
  definedSchedules: definedSchedulesHelper,
  dateProcessor,
  timeConverter,
  dateHelper,
  formatCurrency,
  nodemailerMail,
  mailTemplates,
  countTotalSchedule
} = require('@helpers');
const { presenceOverdueCheck: presenceOverdueCheckV2 } = require('@helpers/v2');
const { presenceOverdueCheck: presenceOverdueCheckV1 } = require('@helpers');
const {
  employees: Employee,
  companies: Company,
  company_settings: CompanySetting,
  digital_assets: DigitalAsset,
  presences: Presence,
  journals: Journals,
  salary_groups: SalaryGroups,
  users: User,
  employee_notes: EmployeeNote,
  journal_details: JournalDetails,
  division_details: DivisionDetails,
  divisions: Divisions
} = require('@models');
const { presenceService } = require('@services/v1');
const path = require('path');
const config = require('config');
const fs = require('fs');
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const checklog = {
  check: async (req, res) => {
    const { id } = req.params;
    const { employeeId } = res.local.users;
    try {
      const company = await Employee.findOne({
        where: { id: employeeId }
      });
      const user = await User.findOne({
        where: { id },
        include: { model: Employee, where: { company_id: company.company_id } }
      });
      if (!user) {
        return res.status(400).json(response(false, 'User tidak ditemukan dalam tim ini'));
      }
      const date = new Date();
      date.setHours(date.getHours() + 7);
      const today = `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(
        -2
      )}-${date.getDate()}`;
      const todayPresence = await Presence.findOne({
        attributes: ['presence_date', 'presence_start', 'presence_end', 'rest_start', 'rest_end'],
        where: [
          {
            employee_id: user.employees[0].id
          },
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('presence_date'), '%Y-%m-%e'),
            today
          )
        ]
      });
      if (todayPresence && todayPresence.presence_start && todayPresence.presence_end) {
        return res.status(400).json(response(false, 'Anda sudah ceklok hari ini'));
      }
      const payload = {
        today_presence: todayPresence
      };
      return res.status(200).json(response(true, 'Anggota ditemukan', payload));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  checklog: async (req, res, checkLocation = true) => {
    const { id: user_id } = checkLocation ? res.local.users : req.params;
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
    try {
      const employeeData = await Employee.findOne({
        where: { user_id },
        include: [
          {
            model: Company,
            include: [{ model: CompanySetting, as: 'setting' }]
          },
          {
            model: SalaryGroups
          }
        ]
      });
      // Generate All Date in a month based on payroll date
      const rangedDate = dateProcessor.getRangedDate(employeeData.company.setting.payroll_date);
      if (checkLocation) {
        const presencesLocation = req.body.location.replace(/\s/g, '').split(',');
        const companyLocation = employeeData.company.location.replace(/\s/g, '').split(',');
        const radius = compareCoordinates(
          presencesLocation[0],
          presencesLocation[1],
          companyLocation[0],
          companyLocation[1]
        );

        if (parseFloat(radius) >= 505) {
          return res
            .status(400)
            .json(response(false, 'Presensi anda tidak di tempat yang sesuai dengan kantor'));
        }
      }

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

      const thisDate = new Date();
      let presenceDate = new Date();
      presenceDate.setHours(presenceDate.getHours() + 7);
      presenceDate = `${presenceDate.getFullYear()}-${('0' + (presenceDate.getMonth() + 1)).slice(
        -2
      )}-${('0' + presenceDate.getDate()).slice(-2)}`;

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
        const allowance =
          employeeData.salary_groups[0].transport_allowance +
          employeeData.salary_groups[0].lunch_allowance;
        // salary type = 1 indicates that salary calculation will be based on total schedule in current month
        if (employeeData.salary_groups[0].salary_type === '1') {
          const numberOfSchedule = await countTotalSchedule(
            employeeData.id,
            rangedDate.dateStart,
            rangedDate.dateEnd
          );
          // Get today schedule
          if (todaySchedule.length) {
            dailySalary = employeeData.salary_groups[0].salary / numberOfSchedule + allowance;
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
            if (todaySchedule[0].shift) {
              // EMPLOYEES HAVE SHIFT ON THEIR SCHEDULE
              dailySalary =
                employeeData.salary_groups[0].salary *
                parseInt(todaySchedule[0].shift.schedule_shift.shift_multiply);
              dailySalary = dailySalary + allowance;
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
            userId: user_id,
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
            userId: user_id,
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
  export: async (req, res) => {
    const { company_id } = req.params;
    const { month, year, dateStart, dateEnd } = req.query;
    /**
     * Check if company do not have salary group, use v1 export excel service
     *  */
    let findSalaryGroup = [];
    findSalaryGroup = await SalaryGroups.findAll({ where: { company_id } });
    if (!findSalaryGroup.length) {
      presenceService.export(req, res);
      return;
    }

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
        where: { id: company_id },
        include: { model: CompanySetting, attributes: ['payroll_date'], as: 'setting' }
      });

      let startWorkDate = dateProcessor.getRangedDate(companyData.setting.payroll_date).dateStart;
      startWorkDate = new Date(startWorkDate);
      startWorkDate = `${startWorkDate.getDate()} ${
        dateHelper[startWorkDate.getMonth() + 1]
      } ${startWorkDate.getFullYear()}`;
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
          },
          { model: SalaryGroups },
          { model: DivisionDetails, include: { model: Divisions } }
        ]
      });
      if (!presencesData.length) {
        return res
          .status(400)
          .json(response(false, `Data presensi untuk range tanggal ${start} s/d ${end} tidak ada`));
      }
      const totalMember = await Employee.count({ where: { company_id: company_id, flag: 3 } });

      let workbook = new Excel.Workbook();
      workbook.creator = 'GajianDulu';
      workbook.created = new Date();
      workbook.modified = new Date();

      let worksheet = workbook.addWorksheet('Data Prensensi');

      for (let s = 1; s <= 19; s++) {
        worksheet.getColumn(s).width = 35;
        if (s % 2 === 1) {
          worksheet.getColumn(s).width = 25;
        }
      }
      worksheet.addRows([
        [
          'Periode',
          `${start} s/d ${end}`,
          '',
          'Legends',
          'Terlambat Masuk / Istirahat',
          'Lembur',
          'Absen'
        ],
        ['Periode', `${start} s/d ${end}`, '', '', 'Ada Jadwal Tidak Ceklok', 'Cuti']
      ]);
      worksheet.mergeCells('A1:A2');
      worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('A1').font = { size: 12, bold: true };
      worksheet.mergeCells('B1:B2');
      worksheet.getCell('B1').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('B1').font = { size: 12, bold: true };
      worksheet.getCell('D1').font = { bold: true };
      worksheet.addRow(['Jumlah Anggota', totalMember]);
      worksheet.getCell('E1').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFff0000' }
      };
      worksheet.getCell('F1').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF01aa1d' }
      };
      worksheet.getCell('G1').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFba9501' }
      };
      worksheet.getCell('E2').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0393a0' }
      };
      worksheet.getCell('F2').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF9702c9' }
      };

      for (let i = 0; i <= presencesData.length - 1; i++) {
        const presenceHeaderTable = [
          'No',
          'Tanggal Presensi',
          'Nama Lengkap',
          'Ada Jadwal Tidak Ceklok',
          'Absen',
          'Cuti',
          'Posisi',
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
        let division = [];
        let divisionRole = [];
        presencesData[i].division_details.forEach(val => {
          division.push(val.division.name);
          divisionRole.push(val.leadership === 1 ? 'Leader' : 'Anggota');
        });
        division = division.toString().replace(/,/g, ' / ');
        divisionRole = divisionRole.toString().replace(/,/g, ' / ');
        let roleName = '';
        if (presencesData[i].role === 1) roleName = 'Manajer';
        else if (presencesData[i].role === 2) roleName = 'Anggota';
        else if (presencesData[i].role === 3) roleName = 'Supervisor';
        else if (presencesData[i].role === 4) roleName = 'Operator';
        let totalPresenceOverdue = 0;
        let totalAbsence = 0;
        let totalOverwork = 0;
        let totalLeave = 0;
        let totalHoliday = 0;
        let totalBonus = 0;
        let totalPenalty = 0;
        let totalSalary = 0;
        let totalWithdraw = 0;
        let totalTransferedSalary = 0;
        let grossWithdraws = 0;
        let debit = 0;
        let credit = 0;
        const totalSchedule = await countTotalSchedule(presencesData[i].id, start, end);

        for (let s = 0; s <= presencesData[i].presences.length - 1; s++) {
          totalOverwork += presencesData[i].presences[s].overwork;
          totalLeave += presencesData[i].presences[s].is_leave;
          totalPresenceOverdue += presencesData[i].presences[s].presence_overdue;
          totalAbsence += presencesData[i].presences[s].is_absence;
          totalHoliday += presencesData[i].presences[s].is_holiday;
        }
        // Find and Count Total Transfered Salary
        const journalData = await Journals.findAll({
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
            model: Journals,
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
        const journal = await Journals.findAll({
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
          'Nama Lengkap',
          presencesData[i].user.full_name,
          'Hari Kerja Sebulan: ',
          `${presencesData[i].workdays || totalSchedule} Hari`,
          'Peran',
          roleName,
          'Total Ada Jadwal Tidak Ceklok',
          '0 Hari',
          'Total Libur',
          `${totalHoliday} Hari`,
          'Total Bonus',
          `Rp. ${formatCurrency(totalBonus)}`,
          'Tunjangan Makan',
          `Rp. ${
            presencesData[i].salary_groups.length
              ? formatCurrency(presencesData[i].salary_groups[0].lunch_allowance || 0)
              : formatCurrency(presencesData[i].meal_allowance || 0)
          }`,
          'Total Tarikan GajianDulu',
          `Rp. ${formatCurrency(totalWithdraw)}`
        ];
        const secondHeaderContent = [
          'No. Telepon',
          presencesData[i].user.phone,
          'Tanggal Masuk Kerja',
          startWorkDate,
          'Divisi',
          division,
          'Total Cuti',
          `${totalLeave} Hari`,
          'Total Lembur',
          timeConverter(totalOverwork),
          'Total Denda',
          `(Rp. ${formatCurrency(totalPenalty)})`,
          'Tunjangan Transpor',
          `Rp. ${
            presencesData[i].salary_groups.length
              ? formatCurrency(presencesData[i].salary_groups[0].transport_allowance || 0)
              : '0'
          }`,
          'Total Upah yang Didapat :',
          `Rp. ${formatCurrency(totalSalary)}`
        ];
        const thirdHeaderContent = [
          'Email',
          presencesData[i].user.email,
          'Golongan Gaji',
          presencesData[i].salary_groups.length
            ? presencesData[i].salary_groups[0].salary_name
            : 'Tidak Tersedia',
          'Peran Divisi',
          divisionRole,
          'Total Tidak Masuk',
          `${totalAbsence} Hari`,
          'Total Terlambat',
          `${totalPresenceOverdue} Menit`,
          'Total Gaji Yang Ditransfer :',
          `Rp. ${formatCurrency(totalTransferedSalary)}`
        ];

        worksheet.addRows([firstHeaderContent, secondHeaderContent, thirdHeaderContent]);
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
          const journal = await Journals.findAll({
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
            presencesData[i].user.full_name,
            'Belum Tersedia',
            presencesData[i].presences[l].is_absence ? 'Ya' : 'Tidak',
            presencesData[i].presences[l].is_leave ? 'Ya' : 'Tidak',
            roleName,
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
            timeConverter(presencesData[i].presences[l].work_hours),
            notes ? notes.notes : 'Tidak ada catatan',
            `Rp. ${formatCurrency(bonus)}`,
            `(Rp. ${formatCurrency(penalty)})`,
            `Rp. ${formatCurrency(salary)}`
          ];
          // MARKING RECORD WITH LEGENDS
          let fgColor = l % 2 === 0 ? 'FFFFFFFF' : 'FFD1D1D1';
          if (presencesData[i].presences[l].is_absence) fgColor = 'FFba9501';
          if (presencesData[i].presences[l].is_leave) fgColor = 'FF9702c9';
          if (presencesData[i].presences[l].presence_overdue) fgColor = 'FFff0000';
          worksheet.addRow(valueRow).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: fgColor }
          };
          if (presencesData[i].presences[l].overwork) {
            worksheet.getCell(`N${worksheet.lastRow._number}`).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF01aa1d' }
            };
          }
        }
        worksheet.getRow(worksheet.lastRow._number + 1).addPageBreak();
      }
      await workbook.xlsx.writeFile(`Presensi-${companyData.codename}-${start}sd${end}.xlsx`);
      /* eslint-disable indent */
      await nodemailerMail.sendMail(
        {
          from: 'cs@atenda.id',
          to: managerEmail.email, // An array if you have multiple recipients.
          subject: `Data Presensi Periode ${start} s/d ${end} - ${companyData.company_name ||
            companyData.name} - Atenda`,
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
            fs.unlinkSync(`Presensi-${companyData.codename}-${start}sd${end}.xlsx`);
            let errorLog = new Date().toISOString() + ' [Export Presence XLS]: ' + err + '\n';
            global.emailErrorLog.write(errorLog);
            return res
              .status(400)
              .json(response(false, 'Coba Lagi, Gagal Mengirim Data Presensi', err));
          } else {
            fs.unlinkSync(`Presensi-${companyData.codename}-${start}sd${end}.xlsx`);
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

module.exports = checklog;

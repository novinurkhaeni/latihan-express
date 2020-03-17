/* eslint-disable indent */
require('module-alias/register');
const Excel = require('exceljs');
const Moment = require('moment-timezone');
const Sequelize = require('sequelize');
const {
  response,
  dateProcessor,
  timeConverter,
  dateHelper,
  formatCurrency,
  nodemailerMail,
  mailTemplates,
  countTotalSchedule,
  countWorkdays,
  zeroWrapper,
  letterGenerator,
  scheduleTemplates: scheduleTemplatesHelper,
  definedSchedules: definedSchedulesHelper,
  scheduleCollector
} = require('@helpers');
const {
  employees: Employee,
  companies: Company,
  parent_companies: ParentCompany,
  company_settings: CompanySetting,
  presences: Presence,
  journals: Journals,
  salary_groups: SalaryGroups,
  users: User,
  employee_notes: EmployeeNote,
  journal_details: JournalDetails,
  division_details: DivisionDetails,
  salary_groups: SalaryGroup,
  divisions: Divisions,
  allowance: Allowance,
  schedule_shifts: ScheduleShift,
  employee_pph21: EmployeePph21,
  ptkp_details: PtkpDetail
} = require('@models');
const fs = require('fs');

const reportExcel = {
  all: async (req, res) => {
    const { company_id } = req.params;
    const { month, year, dateStart, dateEnd, email } = req.query;
    const company_ids = company_id.split(',');
    const { companyParentId } = res.local.users;
    try {
      const companies = await Company.findAll({
        where: { id: { $in: company_ids } },
        include: [
          {
            model: CompanySetting,
            attributes: ['payroll_date'],
            as: 'setting'
          }
        ]
      });

      const companyData = await ParentCompany.findOne({
        where: { id: companyParentId }
      });

      if (companies.length <= 0) {
        return res.status(400).json(response(false, 'Company not found'));
      }

      let workbook = new Excel.Workbook();
      workbook.creator = 'GajianDulu';
      workbook.created = new Date();
      workbook.modified = new Date();

      let worksheet = workbook.addWorksheet('Data Keseluruhan');

      for (let s = 1; s <= 19; s++) {
        worksheet.getColumn(s).width = 35;
        if (s % 2 === 1) {
          worksheet.getColumn(s).width = 25;
        }
      }

      let start = dateStart;
      let end = dateEnd;
      const startDateArray = new Date(start).toString().split(' ');
      const endDateArray = new Date(end).toString().split(' ');
      const startPeriod = `${startDateArray[2]} ${startDateArray[1]} ${startDateArray[3]}`;
      const endPeriod = `${endDateArray[2]} ${endDateArray[1]} ${endDateArray[3]}`;
      const period = `${startPeriod} - ${endPeriod}`;

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

      if (companies.length > 0) {
        for (const company of companies) {
          let startDate = new Date(start);
          let endDate = new Date(end);
          const arrayDate = [];
          while (startDate <= endDate) {
            arrayDate.push(
              `${startDate.getFullYear()}-${('0' + (startDate.getMonth() + 1)).slice(-2)}-${(
                '0' + startDate.getDate()
              ).slice(-2)}`
            );
            startDate.setDate(startDate.getDate() + 1);
          }
          const rangedDate = dateProcessor.getRangedDate(company.setting.payroll_date);

          let header = [
            `${company.company_name}`,
            'Periode',
            `${period}`,
            '',
            'Legends',
            'Terlambat Masuk / Istirahat',
            'Lembur',
            'Absen'
          ];
          worksheet.addRow(header);
          header = ['', '', '', '', '', 'Ada Jadwal Tidak Ceklok', 'Cuti'];
          worksheet.addRow(header);
          header = ['', '', ''];
          worksheet.addRow(header);
          const totalMember = await Employee.count({ where: { company_id: company.id, flag: 3 } });
          const presencesData = await Employee.findAll({
            where: { company_id: company.id },
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
          worksheet.addRow(['Jumlah Anggota', totalMember]);
          for (let i = 0; i < presencesData.length; i++) {
            let scheduleExistButNoPresence = 0;
            // GET MEMBERS DAILY ALLOWANCE
            if (presencesData[i].salary_groups.length) {
              const allowances = await Allowance.findAll({
                where: { salary_groups_id: presencesData[i].salary_groups[0].id, type: 1 },
                attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'amount']]
              });
              presencesData[i].salary_groups[0].dataValues.allowances =
                allowances[0].dataValues.amount;
            }
            // FIND TOTAL ADA JADWAL TIDAK CEKLOK
            const scheduleCollection = await scheduleCollector(presencesData[i].id, start, end);
            for (const schedule of scheduleCollection) {
              const find = presencesData[i].presences.find(
                val => val.presence_date === schedule.presence_date
              );
              if (!find) scheduleExistButNoPresence += 1;
            }

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
            let workdays = 0;
            let totalDailyAllowance = 0;
            let totalMonthlyAllowance = 0;

            // CHECK WHAT DATA TO USE TO COUNT WORKDAYS
            // CHECK IS MEMBER HAS DAILY FREQUENT IN SALARY GROUP
            if (
              presencesData[i].salary_groups.length &&
              presencesData[i].salary_groups[0].daily_frequent
            ) {
              workdays = countWorkdays(
                presencesData[i].salary_groups[0].daily_frequent,
                rangedDate.dateStart,
                rangedDate.dateEnd
              );
            } else {
              // IF MEMBER DO NOT HAVE DAILY FREQUENT, COUNT TOTAL SCHEDULE INSTEAD
              workdays = await countTotalSchedule(
                presencesData[i].id,
                rangedDate.dateStart,
                rangedDate.dateEnd
              );
            }
            // IF WORKDAYS STILL 0, USE WORKDAYS DATA FROM V1.0
            if (!workdays) workdays = presencesData[i].workdays || 0;

            let startWorkDate = presencesData[i].date_start_work;

            if (startWorkDate) {
              startWorkDate = new Date(startWorkDate);
              startWorkDate = `${startWorkDate.getDate()} ${
                dateHelper[startWorkDate.getMonth() + 1]
              } ${startWorkDate.getFullYear()}`;
            } else {
              startWorkDate = 'Tidak ada data';
            }

            for (let s = 0; s <= presencesData[i].presences.length - 1; s++) {
              totalOverwork += presencesData[i].presences[s].overwork;
              totalLeave += presencesData[i].presences[s].is_leave;
              totalPresenceOverdue += presencesData[i].presences[s].presence_overdue;
              totalAbsence += presencesData[i].presences[s].is_absence;
              totalHoliday += presencesData[i].presences[s].is_holiday;
            }
            const journalData = await Journals.findAll({
              where: [
                {
                  $not: {
                    type: 'withdraw'
                  }
                },
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
              ],
              attributes: ['type', 'debet', 'kredit', 'description', 'created_at']
            });

            journalData.map(del => {
              debit += del.debet;
              credit += del.kredit;
            });

            totalTransferedSalary = debit - credit;

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
              if (journal[d].type.toString() === 'allowance') {
                totalDailyAllowance += journal[d].debet;
              }
              if (
                journal[d].type.toString() !== 'salary' &&
                journal[d].type.toString() !== 'allowance'
              ) {
                totalBonus += journal[d].debet;
                totalPenalty += journal[d].kredit;
              }
              if (journal[d].type === 'monthlyAllowance') totalMonthlyAllowance += journal[d].debet;
            }
            totalSalary = totalSalary + totalBonus - totalPenalty;
            const firstHeaderContent = [
              // 1
              'Nama Lengkap',
              presencesData[i].user.full_name,
              // 2
              'Hari Kerja Sebulan: ',
              `${workdays} Hari`,
              // 3
              'Peran',
              roleName,
              // 4
              'Total Ada Jadwal Tidak Ceklok',
              `${scheduleExistButNoPresence} Hari`,
              // 5
              'Total Libur',
              `${totalHoliday} Hari`,
              // 6
              'Gaji Bersih',
              `Rp. ${formatCurrency(totalSalary)}`,
              // 7
              'Total Tarikan GajianDulu',
              `Rp. ${formatCurrency(totalWithdraw)}`,
              // 8
              'Tunjangan Harian',
              `Rp. ${formatCurrency(totalDailyAllowance)}`,
              // 9
              'Deduksi BPJS',
              '(Rp. 0)',
              // 10
              'Total Gaji Diterima :',
              `Rp. ${formatCurrency(totalTransferedSalary)}`
            ];
            const secondHeaderContent = [
              // 1
              'No. Telepon',
              presencesData[i].user.phone,
              // 2
              'Tanggal Masuk Kerja',
              startWorkDate,
              // 3
              'Divisi',
              division,
              // 4
              'Total Cuti',
              `${totalLeave} Hari`,
              // 5
              'Total Lembur',
              timeConverter(totalOverwork),
              // 6
              'Total Bonus',
              `Rp. ${formatCurrency(totalBonus)}`,
              // 7
              '',
              '',
              // 8
              'Tunjangan Bulanan',
              `Rp. ${formatCurrency(totalMonthlyAllowance)}`,
              // 9
              'Deduksi PPh21',
              '(Rp. 0)'
            ];
            const thirdHeaderContent = [
              // 1
              'Email',
              presencesData[i].user.email,
              // 2
              'Golongan Gaji',
              presencesData[i].salary_groups.length
                ? presencesData[i].salary_groups[0].salary_name
                : 'Tidak tersedia',
              // 3
              'Peran Divisi',
              divisionRole,
              // 4
              'Total Tidak Masuk',
              `${totalAbsence} Hari`,
              // 5
              'Total Terlambat',
              `${totalPresenceOverdue} Menit`,
              // 6
              'Total Denda',
              `(Rp. ${formatCurrency(totalPenalty)})`,
              // 7
              '',
              '',
              // 8
              'Pendapatan BPJS',
              'Rp. 0'
            ];

            worksheet.addRows([firstHeaderContent, secondHeaderContent, thirdHeaderContent]);
            worksheet.mergeCells(`S${worksheet.lastRow._number - 2}:S${worksheet.lastRow._number}`);
            worksheet.mergeCells(`T${worksheet.lastRow._number - 2}:T${worksheet.lastRow._number}`);
            worksheet.getCell(`S${worksheet.lastRow._number - 2}`).alignment = {
              horizontal: 'center',
              vertical: 'middle'
            };
            worksheet.getCell(`T${worksheet.lastRow._number - 2}`).alignment = {
              horizontal: 'center',
              vertical: 'middle'
            };
            worksheet.getColumn('T').width = 30;
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
                    Sequelize.fn(
                      'DATE_FORMAT',
                      presencesData[i].presences[l].presence_date,
                      '%Y%c%d'
                    )
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
                if (journal[i].type.toString() === 'other') {
                  bonus += journal[i].debet;
                  penalty += journal[i].kredit;
                }
              }

              salary = salary + bonus - penalty;

              let presenceStart = presencesData[i].presences[l].presence_start
                ? Moment(presencesData[i].presences[l].presence_start)
                    .tz(company.timezone)
                    .add(-process.env.TIMEZONE_OFFSET, 'hour')
                    .format('HH:mm')
                : '-';

              let presenceEnd = presencesData[i].presences[l].presence_end
                ? Moment(presencesData[i].presences[l].presence_end)
                    .tz(company.timezone)
                    .add(-process.env.TIMEZONE_OFFSET, 'hour')
                    .format('HH:mm')
                : '-';
              let restStart = presencesData[i].presences[l].rest_start
                ? Moment(presencesData[i].presences[l].rest_start)
                    .tz(company.timezone)
                    .add(-process.env.TIMEZONE_OFFSET, 'hour')
                    .format('HH:mm')
                : '-';
              let restEnd = presencesData[i].presences[l].rest_end
                ? Moment(presencesData[i].presences[l].rest_end)
                    .tz(company.timezone)
                    .add(-process.env.TIMEZONE_OFFSET, 'hour')
                    .format('HH:mm')
                : '-';

              const valueRow = [
                (l + 1).toString(),
                presencesData[i].presences[l].presence_date,
                presencesData[i].user.full_name,
                '-',
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
        }
      }

      const columnsA = worksheet.getColumn('A');
      const mergeCellArray = [];
      columnsA.eachCell({ includeEmpty: false }, function(cell, rowNumber) {
        const filtered = companies.filter(company => company.company_name === cell.value);
        if (filtered.length > 0) {
          const mergeCells = `A${rowNumber}:A${rowNumber + 2}`;
          mergeCellArray.push(mergeCells);
          worksheet.getCell(`A${rowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };
          worksheet.getCell(`A${rowNumber}`).font = { size: 18, bold: true };
        }
      });
      const columnsB = worksheet.getColumn('B');
      columnsB.eachCell({ includeEmpty: false }, function(cell, rowNumber) {
        if (cell.value === 'Periode') {
          mergeCellArray.push(`B${rowNumber}:B${rowNumber + 2}`);
          worksheet.getCell(`B${rowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };
          worksheet.getCell(`B${rowNumber}`).font = { size: 18, bold: true };
        }
      });

      const columnsC = worksheet.getColumn('C');
      columnsC.width = 40;
      columnsC.eachCell({ includeEmpty: false }, function(cell, rowNumber) {
        if (cell.value === period) {
          mergeCellArray.push(`C${rowNumber}:C${rowNumber + 2}`);
          worksheet.getCell(`C${rowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };
          worksheet.getCell(`C${rowNumber}`).font = { size: 18, bold: true };
        }
      });

      const columnsE = worksheet.getColumn('E');
      columnsE.eachCell({ includeEmpty: false }, function(cell, rowNumber) {
        if (cell.value === 'Legends') {
          worksheet.getCell(`E${rowNumber}`).font = { bold: true };
        }
      });

      const columnsF = worksheet.getColumn('F');
      columnsF.eachCell({ includeEmpty: false }, function(cell, rowNumber) {
        if (cell.value === 'Terlambat Masuk / Istirahat') {
          worksheet.getCell(`F${rowNumber}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFff0000' }
          };
        }
        if (cell.value === 'Ada Jadwal Tidak Ceklok') {
          worksheet.getCell(`F${rowNumber}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0393a0' }
          };
        }
      });

      const columnsG = worksheet.getColumn('G');
      columnsG.eachCell({ includeEmpty: false }, function(cell, rowNumber) {
        if (cell.value === 'Lembur') {
          worksheet.getCell(`G${rowNumber}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF01aa1d' }
          };
        }
        if (cell.value === 'Cuti') {
          worksheet.getCell(`G${rowNumber}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF9702c9' }
          };
        }
      });

      const columnsH = worksheet.getColumn('H');
      columnsH.eachCell({ includeEmpty: false }, function(cell, rowNumber) {
        if (cell.value === 'Absen') {
          worksheet.getCell(`H${rowNumber}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFba9501' }
          };
        }
      });

      mergeCellArray.forEach(cell => worksheet.mergeCells(cell));
      await workbook.xlsx.writeFile(
        `Data Presensi-${companyData.company_name}-${start}sd${end}.xlsx`
      );
      /* eslint-disable indent */
      await nodemailerMail.sendMail(
        {
          from: 'cs@atenda.id',
          to: email, // An array if you have multiple recipients.
          subject: `Data Presensi Periode ${start} s/d ${end} - ${companyData.company_name} - Atenda`,
          //You can use 'html:' to send HTML email content. It's magic!
          html: mailTemplates.presencesXls({
            companyName: companyData.company_name,
            start,
            end,
            category: 'Data Presensi'
          }),
          attachments: [
            {
              filename: `Data Presensi-${companyData.company_name}-${start}sd${end}.xlsx`,
              path: `Data Presensi-${companyData.company_name}-${start}sd${end}.xlsx`
            }
          ]
        },
        function(err, info) {
          if (err) {
            fs.unlinkSync(`Data Presensi-${companyData.company_name}-${start}sd${end}.xlsx`);
            let errorLog = new Date().toISOString() + ' [Export Presence XLS]: ' + err + '\n';
            global.emailErrorLog.write(errorLog);
            return res
              .status(400)
              .json(response(false, 'Coba Lagi, Gagal Mengirim Data Presensi', err));
          } else {
            fs.unlinkSync(`Data Presensi-${companyData.company_name}-${start}sd${end}.xlsx`);
            return res.status(200).json(response(true, 'Data presensi telah dikirim'));
          }
        }
      );
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  attendanceReport: async (req, res) => {
    const { company_id } = req.params;
    const { dateStart, dateEnd, email } = req.query;
    const companyIds = company_id.split(',');
    const { companyParentId } = res.local.users;
    const borderStyles = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    try {
      const data = [];
      const companies = await Company.findAll({
        where: { id: companyIds },
        include: { model: ScheduleShift, required: false, where: { is_deleted: 0 } }
      });

      const presences = await Presence.findAll({
        where: { presence_date: { $between: [dateStart, dateEnd] } },
        order: [[Sequelize.col('presences.presence_date'), 'DESC']],
        include: {
          model: Employee,
          where: { company_id: companyIds },
          required: true,
          include: [
            { model: User, attributes: ['full_name'] },
            {
              model: DivisionDetails,
              include: { model: Divisions, attributes: ['name'] },
              required: false
            },
            {
              model: EmployeeNote,
              where: Sequelize.where(
                Sequelize.col('employee->employee_notes.date'),
                '=',
                Sequelize.col('presences.presence_date')
              ),
              required: false
            }
          ]
        }
      });

      for (const company of companies) {
        let compose = company;
        const findPresence = presences.filter(val => val.employee.company_id === company.id);
        Object.assign(compose.dataValues, { presences: findPresence });
        data.push(compose);
      }
      for (let i = 0; i < data.length; i++) {
        if (data[i].dataValues.presences.length)
          data[i].dataValues.presences.sort((a, b) =>
            a.employee_id > b.employee_id ? 1 : b.employee_id > a.employee_id ? -1 : 0
          );
      }

      const parentCompany = await ParentCompany.findOne({ where: { id: companyParentId } });

      const workbook = new Excel.Workbook();
      workbook.creator = 'Atenda';
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet('Laporan Absensi', {
        properties: { showGridLines: true }
      });
      // FIND MAXIMUM AMOUNT OF SHIFT
      let maxShift = [];
      for (const value of data) {
        if (value.schedule_shifts) maxShift.push(value.schedule_shifts.length);
      }
      maxShift = Math.max(...maxShift);
      for (let i = 1; i <= maxShift * 2 + 11; i++) {
        worksheet.getColumn(i).width = 20;
      }
      for (const company of data) {
        // INSERT TITLE
        worksheet.addRow([`${company.company_name || company.name} - Laporan Absensi`]);
        //
        let numberOfShift = 0;
        let lastRowNumber = worksheet.lastRow._number;
        if (company.schedule_shifts) numberOfShift = company.schedule_shifts.length;
        const endCell = letterGenerator(10 + numberOfShift * 2);
        worksheet.mergeCells(`A${lastRowNumber}:${endCell}${lastRowNumber}`);
        worksheet.getRow(lastRowNumber).font = { size: 18, bold: true };
        worksheet.getCell(`A${lastRowNumber}`).alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };
        worksheet.lastRow.height = 30;
        worksheet.addRow(['Periode', `${dateStart} - ${dateEnd}`]);
        lastRowNumber = worksheet.lastRow._number;
        worksheet.getRow(lastRowNumber).font = { bold: true };
        worksheet.mergeCells(`B${lastRowNumber}:C${lastRowNumber}`);
        worksheet.mergeCells(`D${lastRowNumber}:${endCell}${lastRowNumber}`);
        const firstHeaderTable = ['User ID', 'Nama', 'Divisi', 'Tanggal'];
        const secondHeaderTable = ['', '', '', ''];
        for (const value of company.schedule_shifts) {
          firstHeaderTable.push(value.shift_name);
          firstHeaderTable.push('');
          secondHeaderTable.push(value.start_time);
          secondHeaderTable.push(value.end_time);
        }
        firstHeaderTable.push(
          'Tidak Ada Jadwal',
          '',
          'Terlambat(Min)',
          'Pulang Awal',
          'Absensi',
          'Total',
          'Catatan'
        );
        secondHeaderTable.push('Masuk', 'Pulang');
        worksheet.addRow(firstHeaderTable);
        worksheet.addRow(secondHeaderTable);
        let prevLetterIndex = 3;
        let nextLetterIndex = 3;
        let noScheduleLetter;
        const shiftCoordinate = [];
        for (const value of company.schedule_shifts) {
          nextLetterIndex += 1;
          prevLetterIndex = nextLetterIndex;
          shiftCoordinate.push({ id: value.id, letter: letterGenerator(nextLetterIndex) });
          nextLetterIndex += 1;
          worksheet.mergeCells(
            `${letterGenerator(prevLetterIndex)}${lastRowNumber + 1}:${letterGenerator(
              nextLetterIndex
            )}${lastRowNumber + 1}`
          );
        }
        nextLetterIndex += 1;
        prevLetterIndex = nextLetterIndex;
        noScheduleLetter = nextLetterIndex;
        nextLetterIndex += 1;
        worksheet.mergeCells(
          `${letterGenerator(letterGenerator(prevLetterIndex))}${lastRowNumber +
            1}:${letterGenerator(nextLetterIndex)}${lastRowNumber + 1}`
        );

        lastRowNumber = worksheet.lastRow._number;
        let letter = 'A';
        for (let i = 1; i <= 3; i++) {
          letter = String.fromCharCode(letter.charCodeAt() + 1);
          worksheet.mergeCells(`${letter}${lastRowNumber - 1}:${letter}${lastRowNumber}`);
        }
        for (let i = 1; i <= 5; i++) {
          nextLetterIndex += 1;
          worksheet.mergeCells(
            `${letterGenerator(nextLetterIndex)}${lastRowNumber - 1}:${letterGenerator(
              nextLetterIndex
            )}${lastRowNumber}`
          );
        }
        for (let i = 0; i <= 1; i++) {
          worksheet.getRow(lastRowNumber - i).font = { bold: true };
          worksheet.getRow(lastRowNumber - i).alignment = {
            vertical: 'middle',
            horizontal: 'center'
          };
        }
        for (const presence of company.dataValues.presences) {
          let collectDivisions = [];
          let employeeNotes = [];
          let presenceType = 'Hadir';
          let findShiftCoordinate;
          const presenceStart = presence.presence_start
            ? Moment(presence.presence_start)
                .tz(company.timezone)
                .add(-process.env.TIMEZONE_OFFSET, 'hour')
                .format('HH:mm')
            : '-';
          const presenceEnd = presence.presence_end
            ? Moment(presence.presence_end)
                .tz(company.timezone)
                .add(-process.env.TIMEZONE_OFFSET, 'hour')
                .format('HH:mm')
            : '-';
          presence.employee.division_details.map(val => collectDivisions.push(val.division.name));
          presence.employee.employee_notes.map(val => employeeNotes.push(val.notes));
          if (presence.is_absence) presenceType = 'Tidak Hadir';
          else if (presence.is_leave) presenceType = 'Cuti';
          else if (presence.is_holiday) presenceType = 'Libur';
          else if (presence.is_permit) presenceType = 'Izin';
          // FIND SCHEDULE
          let schedule = await scheduleTemplatesHelper(
            presence.presence_date,
            presence.employee_id,
            company.id,
            true
          );
          if (!schedule.length) {
            schedule = await definedSchedulesHelper(
              presence.presence_date,
              company.id,
              presence.employee_id
            );
          }
          let goHomeEarly = 0;
          if (schedule.length && presenceEnd !== '-') {
            // COUNT GO HOME EARLY
            const formatedPresenceEnd = new Date(
              '',
              '',
              '',
              presenceEnd.split(':')[0],
              presenceEnd.split(':')[1]
            );
            const formatedScheduleEnd = new Date(
              '',
              '',
              '',
              schedule[0].shift.schedule_shift.end_time.split(':')[0],
              schedule[0].shift.schedule_shift.end_time.split(':')[1]
            );
            goHomeEarly = (formatedScheduleEnd - formatedPresenceEnd) / 36e5;
            if (goHomeEarly < 0) goHomeEarly = 0;
          }

          const content = [
            // User ID
            zeroWrapper(presence.employee.user_id),
            // Name
            presence.employee.user.full_name,
            // Division(s)
            collectDivisions.toString().replace(/,/g, ', '),
            // Presence Date
            presence.presence_date,
            // Late
            formatCurrency(presence.presence_overdue || 0),
            // Pulang Awal,
            timeConverter(goHomeEarly),
            // Presence Type
            presenceType,
            // Total
            timeConverter(presence.work_hours),
            // Notes
            employeeNotes.toString().replace(/,/g, ', ')
          ];
          let contentIndex = 4;
          for (let i = 1; i <= numberOfShift; i++) {
            content.splice(contentIndex, 0, '', '');
            contentIndex = contentIndex + 2;
          }
          content.splice(contentIndex, 0, '', '');
          worksheet.addRow(content);
          lastRowNumber = worksheet.lastRow._number;
          if (schedule.length) {
            findShiftCoordinate = shiftCoordinate.find(
              val => val.id === schedule[0].shift.shift_id
            );
            const nextScheduleLetter = String.fromCharCode(
              findShiftCoordinate.letter.charCodeAt() + 1
            );
            worksheet.getCell(
              `${findShiftCoordinate.letter}${lastRowNumber}`
            ).value = presenceStart;
            worksheet.getCell(`${nextScheduleLetter}${lastRowNumber}`).value = presenceEnd;
          } else {
            const nextNoScheduleLetter = noScheduleLetter + 1;
            worksheet.getCell(
              `${letterGenerator(noScheduleLetter)}${lastRowNumber}`
            ).value = presenceStart;
            worksheet.getCell(
              `${letterGenerator(nextNoScheduleLetter)}${lastRowNumber}`
            ).value = presenceEnd;
          }
        }
        worksheet.getRow(worksheet.lastRow._number + 2).addPageBreak();
      }
      // ADD BORDER INTO EACH CELLS
      worksheet.eachRow(function(row, rowNumber) {
        row.eachCell(function(cell, colNumber) {
          cell.border = borderStyles;
        });
      });
      await workbook.xlsx.writeFile(
        `Laporan Absensi-${parentCompany.company_name}-${dateStart}sd${dateEnd}.xlsx`
      );
      /* eslint-disable indent */
      await nodemailerMail.sendMail(
        {
          from: 'cs@atenda.id',
          to: email, // An array if you have multiple recipients.
          subject: `Laporan Absensi ${dateStart} s/d ${dateEnd} - ${parentCompany.company_name} - Atenda`,
          //You can use 'html:' to send HTML email content. It's magic!
          html: mailTemplates.presencesXls({
            companyName: parentCompany.company_name,
            start: dateStart,
            end: dateEnd,
            category: 'Laporan Absensi'
          }),
          attachments: [
            {
              filename: `Laporan Absensi-${parentCompany.company_name}-${dateStart}sd${dateEnd}.xlsx`,
              path: `Laporan Absensi-${parentCompany.company_name}-${dateStart}sd${dateEnd}.xlsx`
            }
          ]
        },
        function(err, info) {
          if (err) {
            fs.unlinkSync(
              `Laporan Absensi-${parentCompany.company_name}-${dateStart}sd${dateEnd}.xlsx`
            );
            let errorLog = new Date().toISOString() + ' [Export Presence XLS]: ' + err + '\n';
            global.emailErrorLog.write(errorLog);
            return res
              .status(400)
              .json(response(false, 'Coba Lagi, Gagal Mengirim Laporan Absensi', err));
          } else {
            fs.unlinkSync(
              `Laporan Absensi-${parentCompany.company_name}-${dateStart}sd${dateEnd}.xlsx`
            );
            return res.status(200).json(response(true, 'Laporan absensi telah dikirim'));
          }
        }
      );
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  presenceReport: async (req, res) => {
    const { company_id } = req.params;
    const { dateStart, dateEnd, email } = req.query;
    const companyIds = company_id.split(',');
    const { companyParentId } = res.local.users;
    const borderStyles = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    try {
      const data = await Company.findAll({
        where: { id: companyIds },
        include: [
          {
            model: Employee,
            required: false,
            where: { active: 1, flag: 3 },
            include: [
              { model: User, attributes: ['full_name'] },
              {
                model: DivisionDetails,
                include: { model: Divisions, attributes: ['name'] },
                required: false
              },
              {
                model: Presence,
                where: { presence_date: { $between: [dateStart, dateEnd] } },
                required: false
              }
            ]
          }
        ]
      });

      const parentCompany = await ParentCompany.findOne({ where: { id: companyParentId } });

      const workbook = new Excel.Workbook();
      workbook.creator = 'Atenda';
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet('Laporan Jadwal', {
        properties: { showGridLines: true }
      });

      // Generate All Date in a month based on given ranged date
      const arrayDate = [];
      const start = new Date(dateStart);
      const end = new Date(dateEnd);
      while (start <= end) {
        const date = `${start.getFullYear()}-${('0' + (start.getMonth() + 1)).slice(-2)}-${(
          '0' + start.getDate()
        ).slice(-2)}`;
        arrayDate.push({ date, dateOfMonth: new Date(date).getDate() });
        start.setDate(start.getDate() + 1);
      }
      for (let i = 1; i <= arrayDate.length; i++) {
        worksheet.getColumn(i).width = 10;
      }
      for (const company of data) {
        // TITLE
        worksheet.addRow([`${company.company_name || company.name} - Laporan Jadwal`]);
        let lastRowNumber = worksheet.lastRow._number;
        worksheet.mergeCells(
          `A${lastRowNumber}:${letterGenerator(arrayDate.length - 1)}${lastRowNumber}`
        );
        worksheet.getRow(lastRowNumber).font = { size: 18, bold: true };
        worksheet.getCell(`A${lastRowNumber}`).alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };
        worksheet.lastRow.height = 30;
        // PERIOD
        worksheet.addRow(['Periode', `${dateStart} - ${dateEnd}`]);
        lastRowNumber = worksheet.lastRow._number;
        worksheet.getRow(lastRowNumber).font = { bold: true };
        worksheet.mergeCells(`B${lastRowNumber}:C${lastRowNumber}`);
        worksheet.mergeCells(
          `D${lastRowNumber}:${letterGenerator(arrayDate.length - 1)}${lastRowNumber}`
        );
        // HEADER
        const header = [];
        arrayDate.map(val => header.push(val.dateOfMonth.toString()));
        worksheet.addRow(header);
        lastRowNumber = worksheet.lastRow._number;
        worksheet.getRow(lastRowNumber).alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.lastRow.height = 20;
        //  CONTENT
        for (const employee of company.employees) {
          const collectDivisions = [];
          employee.division_details.map(val => collectDivisions.push(val.division.name));
          // FIRST CONTENT
          const firstContent = [
            'ID:',
            zeroWrapper(employee.user_id),
            '',
            '',
            'Nama:',
            employee.user.full_name,
            '',
            '',
            'Divisi:',
            collectDivisions.toString().replace(/,/g, ', ')
          ];
          worksheet.addRow(firstContent);
          lastRowNumber = worksheet.lastRow._number;
          worksheet.mergeCells(`B${lastRowNumber}:D${lastRowNumber}`);
          worksheet.mergeCells(`F${lastRowNumber}:H${lastRowNumber}`);
          worksheet.mergeCells(
            `J${lastRowNumber}:${letterGenerator(arrayDate.length - 1)}${lastRowNumber}`
          );
          // SECOND CONTENT
          const secondContent = [];
          for (const date of arrayDate) {
            const schedule = await countTotalSchedule(employee.id, date.date, date.date);
            const presence = employee.presences.find(val => {
              return val.presence_date === date.date;
            });
            let presenceTime = '-';
            const wrapPresenceTime = [];
            if (presence) {
              if (
                !presence.is_leave &&
                !presence.is_absence &&
                !presence.is_holiday &&
                !presence.is_permit
              ) {
                const presenceStart = presence.presence_start
                  ? Moment(presence.presence_start)
                      .tz(company.timezone)
                      .add(-process.env.TIMEZONE_OFFSET, 'hour')
                      .format('HH:mm')
                  : false;
                const presenceEnd = presence.presence_end
                  ? Moment(presence.presence_end)
                      .tz(company.timezone)
                      .add(-process.env.TIMEZONE_OFFSET, 'hour')
                      .format('HH:mm')
                  : false;
                const restStart = presence.rest_start
                  ? Moment(presence.rest_start)
                      .tz(company.timezone)
                      .add(-process.env.TIMEZONE_OFFSET, 'hour')
                      .format('HH:mm')
                  : false;
                const restEnd = presence.rest_end
                  ? Moment(presence.rest_end)
                      .tz(company.timezone)
                      .add(-process.env.TIMEZONE_OFFSET, 'hour')
                      .format('HH:mm')
                  : false;
                if (presenceStart) wrapPresenceTime.push(presenceStart);
                if (presenceEnd) wrapPresenceTime.push(presenceEnd);
                if (restStart) wrapPresenceTime.push(restStart);
                if (restEnd) wrapPresenceTime.push(restEnd);
              } else {
                if (presence.is_leave) wrapPresenceTime.push('Cuti');
                if (presence.is_absence) wrapPresenceTime.push('Tidak Masuk');
                if (presence.is_holiday) wrapPresenceTime.push('Libur');
                if (presence.is_permit) wrapPresenceTime.push('Izin');
              }
            }
            if (wrapPresenceTime.length) {
              presenceTime = wrapPresenceTime.toString();
              presenceTime = presenceTime.replace(/,/g, '\n');
            }
            if (!wrapPresenceTime.length && schedule) presenceTime = 'Ada jadwal, tidak ceklok';
            secondContent.push(presenceTime);
          }
          worksheet.addRow(secondContent);
          lastRowNumber = worksheet.lastRow._number;
          worksheet.getRow(lastRowNumber).alignment = {
            wrapText: true,
            horizontal: 'center',
            vertical: 'middle'
          };
          worksheet.lastRow.height = 50;
        }

        worksheet.getRow(worksheet.lastRow._number + 2).addPageBreak();
      }

      // ADD BORDER INTO EACH CELLS
      worksheet.eachRow(function(row, rowNumber) {
        row.eachCell(function(cell, colNumber) {
          cell.border = borderStyles;
        });
      });
      await workbook.xlsx.writeFile(
        `Laporan Jadwal-${parentCompany.company_name}-${dateStart}sd${dateEnd}.xlsx`
      );

      /* eslint-disable indent */
      await nodemailerMail.sendMail(
        {
          from: 'cs@atenda.id',
          to: email, // An array if you have multiple recipients.
          subject: `Laporan Jadwal ${dateStart} s/d ${dateEnd} - ${parentCompany.company_name} - Atenda`,
          //You can use 'html:' to send HTML email content. It's magic!
          html: mailTemplates.presencesXls({
            companyName: parentCompany.company_name,
            start: dateStart,
            end: dateEnd,
            category: 'Laporan Jadwal'
          }),
          attachments: [
            {
              filename: `Laporan Jadwal-${parentCompany.company_name}-${dateStart}sd${dateEnd}.xlsx`,
              path: `Laporan Jadwal-${parentCompany.company_name}-${dateStart}sd${dateEnd}.xlsx`
            }
          ]
        },
        function(err, info) {
          if (err) {
            fs.unlinkSync(
              `Laporan Jadwal-${parentCompany.company_name}-${dateStart}sd${dateEnd}.xlsx`
            );
            let errorLog = new Date().toISOString() + ' [Export Presence XLS]: ' + err + '\n';
            global.emailErrorLog.write(errorLog);
            return res
              .status(400)
              .json(response(false, 'Coba Lagi, Gagal Mengirim Laporan Jadwal', err));
          } else {
            fs.unlinkSync(
              `Laporan Jadwal-${parentCompany.company_name}-${dateStart}sd${dateEnd}.xlsx`
            );
            return res.status(200).json(response(true, 'Laporan jadwal telah dikirim'));
          }
        }
      );
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  attendanceStatisticReport: async (req, res) => {
    const { company_id } = req.params;
    const { month, year, dateStart, dateEnd, email } = req.query;
    const company_ids = company_id.split(',');
    const { companyParentId } = res.local.users;
    const borderStyles = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    try {
      const companies = await Company.findAll({
        where: { id: { $in: company_ids } },
        include: [
          {
            model: Presence,
            where: { presence_date: { $between: [dateStart, dateEnd] } },
            required: false,
            order: [[Sequelize.col('presences.presence_date'), 'DESC']],
            include: {
              model: Employee,
              required: false,
              include: [
                {
                  model: EmployeeNote,
                  where: Sequelize.where(
                    Sequelize.col('presences->employee->employee_notes.date'),
                    '=',
                    Sequelize.col('presences.presence_date')
                  ),
                  required: false
                }
              ]
            }
          },
          {
            model: Employee,
            include: [
              {
                model: Presence,
                where: { presence_date: { $between: [dateStart, dateEnd] } },
                order: [[Sequelize.col('presences.presence_date'), 'DESC']]
              },
              { model: User, attributes: ['full_name'] },
              {
                model: DivisionDetails,
                include: { model: Divisions, attributes: ['name'] },
                required: false
              }
            ]
          }
        ]
      });

      const companyData = await ParentCompany.findOne({
        where: { id: companyParentId }
      });

      if (companies.length <= 0) {
        return res.status(400).json(response(false, 'Company not found'));
      }

      let workbook = new Excel.Workbook();
      workbook.creator = 'GajianDulu';
      workbook.created = new Date();
      workbook.modified = new Date();

      let worksheet = workbook.addWorksheet('Statistik Absensi');
      for (let s = 1; s <= 16; s++) {
        worksheet.getColumn(s).width = 15;
      }
      let start = dateStart;
      let end = dateEnd;

      const startDateArray = new Date(start).toString().split(' ');
      const endDateArray = new Date(end).toString().split(' ');
      const startPeriod = `${startDateArray[2]} ${startDateArray[1]} ${startDateArray[3]}`;
      const endPeriod = `${endDateArray[2]} ${endDateArray[1]} ${endDateArray[3]}`;
      const period = `${startPeriod} - ${endPeriod}`;

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

      if (companies.length > 0) {
        for (const company of companies) {
          let arrayDate = [];
          const startDate = new Date(dateStart);
          const endDate = new Date(dateEnd);
          while (startDate <= endDate) {
            arrayDate.push(
              `${startDate.getFullYear()}-${('0' + (startDate.getMonth() + 1)).slice(-2)}-${(
                '0' + startDate.getDate()
              ).slice(-2)}`
            );
            startDate.setDate(startDate.getDate() + 1);
          }

          worksheet.addRow([`${company.company_name}`]);
          const endCell = String.fromCharCode('A'.charCodeAt() + 15);
          let lastRowNumber = worksheet.lastRow._number;
          worksheet.mergeCells(`A${lastRowNumber}:${endCell}${lastRowNumber}`);
          worksheet.getRow(lastRowNumber).font = { size: 18, bold: true };
          worksheet.getCell(`A${lastRowNumber}`).alignment = {
            vertical: 'middle',
            horizontal: 'center'
          };

          worksheet.addRow(['Periode', `${period}`]);
          lastRowNumber = worksheet.lastRow._number;
          worksheet.getRow(lastRowNumber).font = { bold: true };
          worksheet.addRow([
            'User ID',
            'Nama',
            'Divisi',
            'Waktu Kerja',
            '',
            'Terlambat',
            '',
            'Pulang Awal',
            '',
            'Lembur',
            'Kehadiran\r\n(Terjadwal/Aktual)',
            'Ada Jadwal, Tidak Ceklok (Hari)',
            'Tidak Masuk',
            'Izin (Hari)',
            'Cuti (Hari)',
            'Catatan'
          ]);
          worksheet.addRow([
            '',
            '',
            '',
            'Terjadwal',
            'Aktual',
            'Frekuensi',
            'Menit',
            'Frekuensi',
            'Menit',
            '',
            '',
            '',
            '',
            '',
            '',
            ''
          ]);
          lastRowNumber = worksheet.lastRow._number - 1;
          worksheet.mergeCells(`A${lastRowNumber}:A${lastRowNumber + 1}`);
          worksheet.getCell(`A${lastRowNumber}`).alignment = {
            vertical: 'middle',
            horizontal: 'center'
          };

          worksheet.mergeCells(`B${lastRowNumber}:B${lastRowNumber + 1}`);
          worksheet.getCell(`B${lastRowNumber}`).alignment = {
            vertical: 'middle',
            horizontal: 'center'
          };

          worksheet.mergeCells(`C${lastRowNumber}:C${lastRowNumber + 1}`);
          worksheet.getCell(`C${lastRowNumber}`).alignment = {
            vertical: 'middle',
            horizontal: 'center'
          };

          worksheet.mergeCells(`D${lastRowNumber}:E${lastRowNumber}`);
          worksheet.getCell(`D${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`F${lastRowNumber}:G${lastRowNumber}`);
          worksheet.getCell(`F${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`H${lastRowNumber}:I${lastRowNumber}`);
          worksheet.getCell(`H${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`J${lastRowNumber}:J${lastRowNumber + 1}`);
          worksheet.getCell(`J${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`K${lastRowNumber}:K${lastRowNumber + 1}`);
          worksheet.getCell(`K${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`L${lastRowNumber}:L${lastRowNumber + 1}`);
          worksheet.getCell(`L${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`M${lastRowNumber}:M${lastRowNumber + 1}`);
          worksheet.getCell(`M${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`N${lastRowNumber}:N${lastRowNumber + 1}`);
          worksheet.getCell(`N${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`O${lastRowNumber}:O${lastRowNumber + 1}`);
          worksheet.getCell(`O${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`P${lastRowNumber}:P${lastRowNumber + 1}`);
          worksheet.getCell(`P${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          for (const employee of company.employees) {
            let collectDivisions = [];
            let scheduleExistButNoPresence = 0;
            let totalHours = 0;
            let totalActualHours = 0;
            let overdueFrequency = 0;
            let totalOverdue = 0;
            let goHomeEarlyFreq = 0;
            let totalGoHomeEarly = 0;
            let totalOverWork = 0;
            let leave = 0;
            let permit = 0;
            let absence = 0;
            let holiday = 0;
            employee.division_details.map(val => collectDivisions.push(val.division.name));
            const scheduleRanged = [];
            for (let i = 0; i < arrayDate.length; i++) {
              let schedule = [];
              schedule = await scheduleTemplatesHelper(arrayDate[i], employee.id, company.id, true);
              if (!schedule.length) {
                schedule = await definedSchedulesHelper(arrayDate[i], company.id, employee.id);
              }
              if (schedule.length && schedule[0].shift) {
                const compose = schedule[0];
                Object.assign(compose.dataValues, { date: arrayDate[i] });
                scheduleRanged.push(compose);
              }
            }

            //  FIND ADA JADWAL TAPI TIDAK CEKLOK
            const scheduleCollection = await scheduleCollector(employee.id, dateStart, dateEnd);
            for (const schedule of scheduleCollection) {
              const find = employee.presences.find(
                val => val.presence_date === schedule.presence_date
              );
              if (!find) scheduleExistButNoPresence += 1;
            }

            for (const schedule of scheduleRanged) {
              const arrayShiftStart = schedule.dataValues.shift.schedule_shift.start_time.split(
                ':'
              );
              const arrayShiftEnd = schedule.dataValues.shift.schedule_shift.end_time.split(':');
              const shiftStart = new Date('', '', '', arrayShiftStart[0], arrayShiftStart[1], 0, 0);
              const shiftEnd = new Date('', '', '', arrayShiftEnd[0], arrayShiftEnd[1], 0, 0);
              let hours = Math.abs(shiftEnd.getTime() - shiftStart.getTime()) / 3600000;
              totalHours += hours;

              const empPresences = employee.presences.filter(
                presence =>
                  new Date(presence.presence_date).getTime() ===
                    new Date(schedule.dataValues.date).getTime() &&
                  !presence.is_absence &&
                  !presence.is_leave &&
                  !presence.is_holiday &&
                  !presence.is_permit
              );
              if (empPresences.length > 0) {
                for (const presence of empPresences) {
                  if (presence.presence_end) {
                    let goHomeEarly = 0;
                    const formatedPresenceEnd = new Date(
                      '',
                      '',
                      '',
                      presence.presence_end.split(' ')[1].split(':')[0],
                      presence.presence_end.split(' ')[1].split(':')[1]
                    );
                    goHomeEarly = (shiftEnd - formatedPresenceEnd) / 36e5;
                    if (goHomeEarly > 0) {
                      goHomeEarlyFreq++;
                    } else {
                      goHomeEarly = 0;
                    }
                    totalGoHomeEarly += goHomeEarly;
                  }
                }
              }
            }

            for (const presence of employee.presences) {
              if (
                !presence.is_absence &&
                !presence.is_leave &&
                !presence.is_holiday &&
                !presence.is_permit
              ) {
                const actualHours =
                  Math.abs(
                    new Date(presence.presence_end).getTime() -
                      new Date(presence.presence_start).getTime()
                  ) / 3600000;
                totalActualHours += actualHours;
              }

              if (presence.presence_overdue > 0) {
                overdueFrequency++;
              }

              if (presence.is_absence) {
                absence++;
              }
              if (presence.is_leave) {
                leave++;
              }
              if (presence.is_permit) {
                permit++;
              }
              if (presence.is_holiday) {
                holiday++;
              }
              totalOverWork += presence.overwork;
              totalOverdue += presence.presence_overdue;
            }

            const employeeNotes = [];
            for (const presence of company.presences) {
              if (presence.employee.id === employee.id) {
                presence.employee.employee_notes.map(val => employeeNotes.push(val.notes));
              }
            }
            const workday = employee.presences.length - absence - leave - holiday - permit;
            worksheet.addRow([
              zeroWrapper(employee.user_id),
              employee.user.full_name,
              collectDivisions.toString().replace(/,/g, ', '),
              timeConverter(totalHours),
              timeConverter(totalActualHours),
              overdueFrequency,
              totalOverdue || 0,
              goHomeEarlyFreq,
              timeConverter(totalGoHomeEarly),
              timeConverter(totalOverWork),
              `${scheduleRanged.length} / ${workday}`,
              scheduleExistButNoPresence,
              absence,
              permit,
              leave,
              employeeNotes.toString().replace(/,/g, ', ')
            ]);
          }
          worksheet.getRow(worksheet.lastRow._number + 2).addPageBreak();
        }
      }
      worksheet.eachRow(function(row, rowNumber) {
        row.eachCell(function(cell, colNumber) {
          cell.border = borderStyles;
        });
      });

      await workbook.xlsx.writeFile(
        `Statistik Absensi-${companyData.company_name}-${start}sd${end}.xlsx`
      );
      /* eslint-disable indent */
      await nodemailerMail.sendMail(
        {
          from: 'cs@atenda.id',
          to: email, // An array if you have multiple recipients.
          subject: `Statisik Absensi Periode ${start} s/d ${end} - ${companyData.company_name} - Atenda`,
          //You can use 'html:' to send HTML email content. It's magic!
          html: mailTemplates.presencesXls({
            companyName: companyData.company_name,
            start,
            end,
            category: 'Statistik Absensi'
          }),
          attachments: [
            {
              filename: `Statistik Absensi-${companyData.company_name}-${start}sd${end}.xlsx`,
              path: `Statistik Absensi-${companyData.company_name}-${start}sd${end}.xlsx`
            }
          ]
        },
        function(err, info) {
          if (err) {
            fs.unlinkSync(`Statistik Absensi-${companyData.company_name}-${start}sd${end}.xlsx`);
            let errorLog = new Date().toISOString() + ' [Export Presence XLS]: ' + err + '\n';
            global.emailErrorLog.write(errorLog);
            return res
              .status(400)
              .json(response(false, 'Coba Lagi, Gagal Mengirim Statistik Absensi', err));
          } else {
            fs.unlinkSync(`Statistik Absensi-${companyData.company_name}-${start}sd${end}.xlsx`);
            return res.status(200).json(response(true, 'Statistik Absensi telah dikirim'));
          }
        }
      );
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  salaryReport: async (req, res) => {
    const { company_id } = req.params;
    const { month, year, dateStart, dateEnd, email } = req.query;
    const company_ids = company_id.split(',');
    const { companyParentId } = res.local.users;
    const borderStyles = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    try {
      const companies = await Company.findAll({
        where: { id: { $in: company_ids } },
        include: [
          {
            model: Employee,
            include: [
              {
                model: Presence,
                where: { presence_date: { $between: [dateStart, dateEnd] } },
                order: [[Sequelize.col('presences.presence_date'), 'DESC']]
              },
              { model: User, attributes: ['full_name'] },
              {
                model: DivisionDetails,
                include: { model: Divisions, attributes: ['name'] },
                required: false
              },
              {
                model: SalaryGroup,
                attributes: [
                  'salary_name',
                  'use_bpjs',
                  'jkk_allowance',
                  'jkm_allowance',
                  'jht_allowance',
                  'jkk_reduction',
                  'jkm_reduction',
                  'jht_reduction'
                ],
                required: false,
                include: {
                  model: Allowance,
                  attributes: ['name', 'type', 'amount'],
                  required: false
                }
              },
              {
                model: Journals,
                where: { created_at: { $between: [dateStart, dateEnd] } },
                attributes: [
                  'salary_groups_id',
                  'type',
                  'debet',
                  'kredit',
                  'include_lunch_allowance',
                  'include_transport_allowance'
                ],
                required: false
              }
            ]
          }
        ]
      });

      const salaryGroups = await SalaryGroup.findAll({
        where: { company_id: company_ids },
        include: {
          model: Allowance,
          attributes: ['name', 'type', 'amount'],
          required: false
        }
      });

      const companyData = await ParentCompany.findOne({
        where: { id: companyParentId }
      });

      if (companies.length <= 0) {
        return res.status(400).json(response(false, 'Company not found'));
      }

      let workbook = new Excel.Workbook();
      workbook.creator = 'GajianDulu';
      workbook.created = new Date();
      workbook.modified = new Date();

      let worksheet = workbook.addWorksheet('Daftar Gaji');
      for (let s = 1; s <= 20; s++) {
        worksheet.getColumn(s).width = 15;
      }
      let start = dateStart;
      let end = dateEnd;

      const startDateArray = new Date(start).toString().split(' ');
      const endDateArray = new Date(end).toString().split(' ');
      const startPeriod = `${startDateArray[2]} ${startDateArray[1]} ${startDateArray[3]}`;
      const endPeriod = `${endDateArray[2]} ${endDateArray[1]} ${endDateArray[3]}`;
      const period = `${startPeriod} - ${endPeriod}`;

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

      if (companies.length > 0) {
        for (const company of companies) {
          let arrayDate = [];
          const startDate = new Date(dateStart);
          const endDate = new Date(dateEnd);
          while (startDate <= endDate) {
            arrayDate.push(
              `${startDate.getFullYear()}-${('0' + (startDate.getMonth() + 1)).slice(-2)}-${(
                '0' + startDate.getDate()
              ).slice(-2)}`
            );
            startDate.setDate(startDate.getDate() + 1);
          }

          worksheet.addRow([`${company.company_name} - Daftar Gaji`]);
          const endCell = String.fromCharCode('A'.charCodeAt() + 19);
          let lastRowNumber = worksheet.lastRow._number;
          worksheet.mergeCells(`A${lastRowNumber}:${endCell}${lastRowNumber}`);
          worksheet.getRow(lastRowNumber).font = { size: 18, bold: true };
          worksheet.getCell(`A${lastRowNumber}`).alignment = {
            vertical: 'middle',
            horizontal: 'center'
          };

          worksheet.addRow(['Periode', `${period}`]);
          lastRowNumber = worksheet.lastRow._number;
          worksheet.getRow(lastRowNumber).font = { bold: true };
          worksheet.addRow([
            'User ID',
            'Nama',
            'Divisi',
            'Golongan Gaji',
            'Hari Kerja\nSebulan',
            'Cuti (Hari)',
            'Izin (Hari)',
            'Libur (Hari)',
            'Ada Jadwal, Tidak Ceklok (Hari)',
            'Tidak Hadir (Hari)',
            'Hari Kerja',
            'Gaji Pokok',
            'Bonus',
            'Tunjangan Harian',
            'Tunjangan Bulanan',
            'Tunjangan JHT BPJS + JKK + JKM',
            'Potongan',
            'Deduksi JHT BPJS + JKK + JKM',
            'PPh 21',
            'Gaji Diterima'
          ]);
          lastRowNumber = worksheet.lastRow._number;
          worksheet.mergeCells(`A${lastRowNumber}:A${lastRowNumber + 3}`);
          worksheet.getCell(`A${lastRowNumber}`).alignment = {
            vertical: 'middle',
            horizontal: 'center'
          };

          worksheet.mergeCells(`B${lastRowNumber}:B${lastRowNumber + 3}`);
          worksheet.getCell(`B${lastRowNumber}`).alignment = {
            vertical: 'middle',
            horizontal: 'center'
          };

          worksheet.mergeCells(`C${lastRowNumber}:C${lastRowNumber + 3}`);
          worksheet.getCell(`C${lastRowNumber}`).alignment = {
            vertical: 'middle',
            horizontal: 'center'
          };

          worksheet.mergeCells(`D${lastRowNumber}:D${lastRowNumber + 3}`);
          worksheet.getCell(`D${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`E${lastRowNumber}:E${lastRowNumber + 3}`);
          worksheet.getCell(`E${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`F${lastRowNumber}:F${lastRowNumber + 3}`);
          worksheet.getCell(`F${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`G${lastRowNumber}:G${lastRowNumber + 3}`);
          worksheet.getCell(`G${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`H${lastRowNumber}:H${lastRowNumber + 3}`);
          worksheet.getCell(`H${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`I${lastRowNumber}:I${lastRowNumber + 3}`);
          worksheet.getCell(`I${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`J${lastRowNumber}:J${lastRowNumber + 3}`);
          worksheet.getCell(`J${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`K${lastRowNumber}:K${lastRowNumber + 3}`);
          worksheet.getCell(`K${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`L${lastRowNumber}:L${lastRowNumber + 3}`);
          worksheet.getCell(`L${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`M${lastRowNumber}:M${lastRowNumber + 3}`);
          worksheet.getCell(`M${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`N${lastRowNumber}:N${lastRowNumber + 3}`);
          worksheet.getCell(`N${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`O${lastRowNumber}:O${lastRowNumber + 3}`);
          worksheet.getCell(`O${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`P${lastRowNumber}:P${lastRowNumber + 3}`);
          worksheet.getCell(`P${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`Q${lastRowNumber}:Q${lastRowNumber + 3}`);
          worksheet.getCell(`Q${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`R${lastRowNumber}:R${lastRowNumber + 3}`);
          worksheet.getCell(`R${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`S${lastRowNumber}:S${lastRowNumber + 3}`);
          worksheet.getCell(`S${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          worksheet.mergeCells(`T${lastRowNumber}:T${lastRowNumber + 3}`);
          worksheet.getCell(`T${lastRowNumber}`).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };

          for (const employee of company.employees) {
            let leave = 0;
            let permit = 0;
            let absence = 0;
            let holiday = 0;
            let scheduleExistButNoPresence = 0;

            let collectDivisions = [];
            employee.division_details.map(val => collectDivisions.push(val.division.name));
            const totalSchedule = await countTotalSchedule(employee.id, dateStart, dateEnd);

            //  FIND ADA JADWAL TAPI TIDAK CEKLOK
            const scheduleCollection = await scheduleCollector(employee.id, dateStart, dateEnd);
            for (const schedule of scheduleCollection) {
              const find = employee.presences.find(
                val => val.presence_date === schedule.presence_date
              );
              if (!find) scheduleExistButNoPresence += 1;
            }

            for (const presence of employee.presences) {
              if (presence.is_absence) {
                absence++;
              }
              if (presence.is_leave) {
                leave++;
              }
              if (presence.is_permit) {
                permit++;
              }

              if (presence.is_holiday) {
                holiday++;
              }
            }

            let workday = employee.presences.length - absence - leave - permit - holiday;

            let bonus = 0;
            let fine = 0;
            let dailyAllowance = 0;
            let monthlyAllowance = 0;
            let totalAllowance = 0;
            let totalReduction = 0;
            let pph21 = 0;
            let employeeSalaryGroup;
            let employeeSalary = 0;
            let employeeNetSalary = 0;
            for (const journal of employee.journals) {
              if (journal.type === 'other' && journal.debet > 0) {
                bonus += journal.debet;
              }
              if (journal.type === 'other' && journal.kredit > 0) {
                fine += journal.kredit;
              }
              if (journal.type === 'salary') {
                employeeSalary += journal.debet;
              }
              if (journal.type === 'allowance') {
                dailyAllowance += journal.debet;
              }
              if (journal.salary_groups_id !== null) {
                employeeSalaryGroup = salaryGroups.find(val => val.id === journal.salary_groups_id);
              }
            }

            for (const allowance of employeeSalaryGroup.allowances) {
              if (allowance.type === 2) {
                monthlyAllowance += allowance.amount;
              }
            }

            if (employeeSalaryGroup && employeeSalaryGroup.use_bpjs) {
              totalAllowance =
                employeeSalaryGroup.jkk_allowance +
                employeeSalaryGroup.jkm_allowance +
                employeeSalaryGroup.jht_allowance;
              totalReduction =
                employeeSalaryGroup.jkk_reduction +
                employeeSalaryGroup.jkm_reduction +
                employeeSalaryGroup.jht_reduction;
            }

            employeeNetSalary =
              employeeSalary +
              bonus +
              dailyAllowance +
              monthlyAllowance +
              totalAllowance -
              fine -
              totalReduction;
            worksheet.addRow([
              zeroWrapper(employee.user_id),
              employee.user.full_name,
              collectDivisions.toString().replace(/,/g, ', '),
              employeeSalaryGroup ? employeeSalaryGroup.salary_name : '-',
              workday,
              leave,
              permit,
              holiday,
              scheduleExistButNoPresence,
              absence,
              totalSchedule,
              `Rp. ${formatCurrency(employeeSalary)}`,
              `Rp. ${formatCurrency(bonus)}`,
              `Rp. ${formatCurrency(dailyAllowance)}`,
              `Rp. ${formatCurrency(monthlyAllowance)}`,
              `Rp. ${formatCurrency(totalAllowance)}`,
              `(Rp. ${formatCurrency(fine)})`,
              `(Rp. ${formatCurrency(totalReduction)})`,
              `Rp. ${formatCurrency(pph21)}`,
              `Rp. ${formatCurrency(employeeNetSalary)}`
            ]);

            lastRowNumber = worksheet.lastRow._number;
            worksheet.getCell(`L${lastRowNumber}`).alignment = {
              horizontal: 'right'
            };
            worksheet.getCell(`M${lastRowNumber}`).alignment = {
              horizontal: 'right'
            };
            worksheet.getCell(`N${lastRowNumber}`).alignment = {
              horizontal: 'right'
            };
            worksheet.getCell(`O${lastRowNumber}`).alignment = {
              horizontal: 'right'
            };
            worksheet.getCell(`P${lastRowNumber}`).alignment = {
              horizontal: 'right'
            };
            worksheet.getCell(`Q${lastRowNumber}`).alignment = {
              horizontal: 'right'
            };
            worksheet.getCell(`R${lastRowNumber}`).alignment = {
              horizontal: 'right'
            };
            worksheet.getCell(`S${lastRowNumber}`).alignment = {
              horizontal: 'right'
            };
            worksheet.getCell(`T${lastRowNumber}`).alignment = {
              horizontal: 'right'
            };
          }
          worksheet.getRow(worksheet.lastRow._number + 2).addPageBreak();
        }
      }
      worksheet.eachRow(function(row, rowNumber) {
        row.eachCell(function(cell, colNumber) {
          cell.border = borderStyles;
        });
      });

      await workbook.xlsx.writeFile(
        `Daftar Gaji-${companyData.company_name}-${start}sd${end}.xlsx`
      );
      /* eslint-disable indent */
      await nodemailerMail.sendMail(
        {
          from: 'cs@atenda.id',
          to: email, // An array if you have multiple recipients.
          subject: `Daftar Gaji Periode ${start} s/d ${end} - ${companyData.company_name} - Atenda`,
          //You can use 'html:' to send HTML email content. It's magic!
          html: mailTemplates.presencesXls({
            companyName: companyData.company_name,
            start,
            end,
            category: 'Daftar Gaji'
          }),
          attachments: [
            {
              filename: `Daftar Gaji-${companyData.company_name}-${start}sd${end}.xlsx`,
              path: `Daftar Gaji-${companyData.company_name}-${start}sd${end}.xlsx`
            }
          ]
        },
        function(err, info) {
          if (err) {
            fs.unlinkSync(`Daftar Gaji-${companyData.company_name}-${start}sd${end}.xlsx`);
            let errorLog = new Date().toISOString() + ' [Export Presence XLS]: ' + err + '\n';
            global.emailErrorLog.write(errorLog);
            return res
              .status(400)
              .json(response(false, 'Coba Lagi, Gagal Mengirim Daftar Gaji', err));
          } else {
            fs.unlinkSync(`Daftar Gaji-${companyData.company_name}-${start}sd${end}.xlsx`);
            return res.status(200).json(response(true, 'Daftar Gaji telah dikirim'));
          }
        }
      );
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  pph21: async (req, res) => {
    const { company_id } = req.params;
    const { dateStart, dateEnd, email } = req.query;
    const companyIds = company_id.split(',');
    const { companyParentId } = res.local.users;
    const borderStyles = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    try {
      const data = await Company.findAll({
        where: { id: companyIds },
        include: [
          {
            model: Employee,
            required: false,
            where: { active: 1, flag: 3 },
            include: [
              { model: User, attributes: ['full_name'] },
              {
                model: DivisionDetails,
                include: { model: Divisions, attributes: ['name'] },
                required: false
              },
              {
                model: Presence,
                where: { presence_date: { $between: [dateStart, dateEnd] } },
                required: false
              },
              {
                model: EmployeePph21,
                include: { model: PtkpDetail },
                required: false
              },
              {
                model: Journals,
                required: false,
                where: [
                  { type: ['salary', 'periodic', 'allowance'] },
                  Sequelize.where(
                    Sequelize.fn(
                      'DATE_FORMAT',
                      Sequelize.col('employees->journals.created_at'),
                      '%Y-%m-%d'
                    ),
                    '>=',
                    `${dateStart}`
                  ),
                  Sequelize.where(
                    Sequelize.fn(
                      'DATE_FORMAT',
                      Sequelize.col('employees->journals.created_at'),
                      '%Y-%m-%d'
                    ),
                    '<=',
                    `${dateEnd}`
                  )
                ]
              },
              {
                model: SalaryGroup,
                required: false,
                include: {
                  model: Allowance,
                  where: { type: 1 },
                  required: false
                }
              }
            ]
          }
        ]
      });
      // FIND MAXIMUM NUMBER OF EMPLOYEE
      let totalEmployee = 0;
      for (const company of data) {
        const total = company.employees.length;
        if (total > totalEmployee) totalEmployee = total;
      }

      const parentCompany = await ParentCompany.findOne({ where: { id: companyParentId } });

      const workbook = new Excel.Workbook();
      workbook.creator = 'Atenda';
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet('Daftar PPh21', {
        properties: { showGridLines: true }
      });

      for (let i = 1; i <= totalEmployee + 1; i++) {
        if (i === 1) worksheet.getColumn(i).width = 30;
        else worksheet.getColumn(i).width = 15;
      }
      let boldIndex = 0;
      const today = new Date();
      for (const company of data) {
        // TITLE
        worksheet.addRow([`${company.company_name || company.name} - Daftar PPh21`]);
        let lastRowNumber = worksheet.lastRow._number;
        worksheet.mergeCells(
          `A${lastRowNumber}:${letterGenerator(company.employees.length || 2)}${lastRowNumber}`
        );
        worksheet.getRow(lastRowNumber).font = { size: 18, bold: true };
        worksheet.getCell(`A${lastRowNumber}`).alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };
        worksheet.lastRow.height = 30;
        // PERIOD
        worksheet.addRow(['Periode', `${dateStart} - ${dateEnd}`]);
        lastRowNumber = worksheet.lastRow._number;
        worksheet.getRow(lastRowNumber).font = { bold: true };
        worksheet.mergeCells(
          `B${lastRowNumber}:${letterGenerator(company.employees.length || 2)}${lastRowNumber}`
        );
        // CONTENT !!!!
        const contents = new Array(27);
        const framework = new Array(27);
        for (const [index] of contents.entries()) {
          contents[index] = new Array(100);
          framework[index] = new Array(100);
        }
        for (const [index, value] of company.employees.entries()) {
          // Nama
          contents[0][index] = value.user.full_name;
          // User Id
          contents[1][index] = zeroWrapper(value.user_id);
          // Break
          contents[2][index] = '';
          // Bulan Kerja
          let totalWorkMonth = 0;
          const dateStartWork = new Date(value.date_start_work);
          if (today.getFullYear() > dateStartWork.getFullYear()) totalWorkMonth = 12;
          else totalWorkMonth = 12 - dateStartWork.getMonth();
          contents[3][index] = totalWorkMonth;
          // NPWP
          contents[4][index] = value.employee_pph21s.length
            ? value.employee_pph21s[0].npwp
            : 'Tidak';
          // Status
          contents[5][index] = value.employee_pph21s.length
            ? value.employee_pph21s[0].ptkp_detail.name
            : 'Tidak';
          // Break
          contents[6][index] = '';
          // Gaji Bersih
          let salary = 0;
          let dailyAllowance = 0;
          const bpjsAllowance = value.salary_groups.length
            ? value.salary_groups[0].bpjs_allowance || 0
            : 0;
          const jkkAllowance = value.salary_groups.length
            ? value.salary_groups[0].jkk_allowance || 0
            : 0;
          const jkmAllowance = value.salary_groups.length
            ? value.salary_groups[0].jkm_allowance || 0
            : 0;
          const bpjsReduction = value.salary_groups.length
            ? value.salary_groups[0].jht_reduction || 0
            : 0;
          const jkkReduction = value.salary_groups.length
            ? value.salary_groups[0].jkk_reduction || 0
            : 0;
          const jkmReduction = value.salary_groups.length
            ? value.salary_groups[0].jkm_reduction || 0
            : 0;
          let otherAllowance = 0;
          value.journals.forEach(val => {
            if (val.type === 'salary') {
              salary += val.debet;
            }
            if (val.type === 'periodic') otherAllowance += val.debet;
            if (val.type === 'allowance') dailyAllowance += val.debet;
          });
          contents[7][index] = `Rp. ${formatCurrency(salary)}`;
          // Tunjangan Harian
          contents[8][index] = `Rp. ${formatCurrency(dailyAllowance)}`;
          // Tunjangan Lainnya
          contents[9][index] = `Rp. ${formatCurrency(otherAllowance)}`;
          // Tunjangan BPJS
          contents[10][index] = `Rp. ${formatCurrency(bpjsAllowance)}`;
          // Tunjangan JKK
          contents[11][index] = `Rp. ${formatCurrency(jkkAllowance)}`;
          // Tunjangan JKM
          contents[12][index] = `Rp. ${formatCurrency(jkmAllowance)}`;
          // Total Pendapatan Bruto
          let salaryBruto =
            salary + dailyAllowance + bpjsAllowance + jkkAllowance + jkmAllowance + otherAllowance;
          contents[13][index] = `Rp. ${formatCurrency(salaryBruto)}`;
          // Break
          contents[14][index] = '';
          // Biaya Jabatan
          const positionAllowance = salary * 0.05;
          contents[15][index] = `(Rp. ${formatCurrency(positionAllowance)})`;
          // Deduksi BPJS
          contents[16][index] = `(Rp. ${formatCurrency(bpjsReduction)})`;
          // Deduksi JKK
          contents[17][index] = `(Rp. ${formatCurrency(jkkReduction)})`;
          // Deduksi JKM
          contents[18][index] = `(Rp. ${formatCurrency(jkmReduction)})`;
          // Total Deduksi Bruto
          const reductionBruto = positionAllowance + bpjsReduction + jkkReduction + jkmReduction;
          contents[19][index] = `(Rp. ${formatCurrency(reductionBruto)})`;
          // Jmlh Pendapatan Netto/Bln
          const monthlyIncome = salaryBruto - reductionBruto;
          contents[20][index] = `Rp. ${formatCurrency(monthlyIncome)}`;
          // Jmlh Pendapatan Netto/Thn
          const yearlyIncome = monthlyIncome * 12;
          contents[21][index] = `Rp. ${formatCurrency(yearlyIncome)}`;
          // PTKP
          const ptkp = value.employee_pph21s.length
            ? value.employee_pph21s[0].ptkp_detail.amount
            : 0;
          contents[22][index] = `Rp. ${formatCurrency(ptkp)}`;
          // PPh 21 Terhutang Setahun
          let yearlyPph21 = 0;
          const count = yearlyIncome - ptkp;
          if (count > 0) yearlyPph21 = count;
          contents[23][index] = `Rp. ${formatCurrency(yearlyPph21)}`;
          // PPh 21 Terhutang Sebulan
          let monthlyPph21 = yearlyPph21 / 12;
          contents[24][index] = `Rp. ${formatCurrency(monthlyPph21)}`;
        }
        const titleContents = [
          'Nama',
          'User ID',
          'Identitas',
          '    Bulan Kerja',
          '    NPWP',
          '    Status',
          'Pendapatan',
          '    Gaji Bersih',
          '    Tunjangan Harian',
          '    Tunjangan Lainnya',
          '    Tunjangan BPJS',
          '    Tunjangan JKK',
          '    Tunjangan JKM',
          'Total Pendapatan Bruto',
          'Deduksi',
          '    Biaya Jabatan',
          '    Deduksi BPJS',
          '    Deduksi JKK',
          '    Deduksi JKM',
          'Total Deduksi Bruto',
          'Jmlh Pendapatan Netto/Bln',
          'Jmlh Pendapatan Netto/Thn',
          'PTKP',
          'PPh21 Terhutang Setahun',
          'Pph21 Terhutang Sebulan'
        ];
        for (const [index, value] of titleContents.entries()) {
          framework[index][0] = value;
        }
        for (const [index, value] of contents.entries()) {
          for (let i = 1; i <= value.length; i++) {
            framework[index][i] = value[i - 1];
          }
        }
        worksheet.addRows(framework);

        for (const [index, value] of titleContents.entries()) {
          if (value[0] !== ' ') {
            worksheet.getCell(`A${index + boldIndex + 3}`).font = { bold: true };
          }
        }
        boldIndex = boldIndex + 30;
        worksheet.getRow(worksheet.lastRow._number + 1).addPageBreak();
      }
      // ADD BORDER INTO EACH CELLS
      worksheet.eachRow(function(row, rowNumber) {
        row.eachCell(function(cell, colNumber) {
          cell.border = borderStyles;
        });
      });
      await workbook.xlsx.writeFile(
        `Daftar PPh21-${parentCompany.company_name}-${dateStart}sd${dateEnd}.xlsx`
      );
      /* eslint-disable indent */
      await nodemailerMail.sendMail(
        {
          from: 'cs@atenda.id',
          to: email, // An array if you have multiple recipients.
          subject: `Daftar PPh21 Periode ${dateStart} s/d ${dateEnd} - ${parentCompany.company_name} - Atenda`,
          //You can use 'html:' to send HTML email content. It's magic!
          html: mailTemplates.presencesXls({
            companyName: parentCompany.company_name,
            start: dateStart,
            end: dateEnd,
            category: 'Daftar PPh21'
          }),
          attachments: [
            {
              filename: `Daftar PPh21-${parentCompany.company_name}-${dateStart}sd${dateEnd}.xlsx`,
              path: `Daftar PPh21-${parentCompany.company_name}-${dateStart}sd${dateEnd}.xlsx`
            }
          ]
        },
        function(err, info) {
          if (err) {
            fs.unlinkSync(
              `Daftar PPh21-${parentCompany.company_name}-${dateStart}sd${dateEnd}.xlsx`
            );
            let errorLog = new Date().toISOString() + ' [Export Presence XLS]: ' + err + '\n';
            global.emailErrorLog.write(errorLog);
            return res
              .status(400)
              .json(response(false, 'Coba Lagi, Gagal Mengirim Daftar PPh21', err));
          } else {
            fs.unlinkSync(
              `Daftar PPh21-${parentCompany.company_name}-${dateStart}sd${dateEnd}.xlsx`
            );
            return res.status(200).json(response(true, 'Daftar PPh21 telah dikirim'));
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

module.exports = reportExcel;

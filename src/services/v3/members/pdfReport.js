require('module-alias/register');
const Sequelize = require('sequelize');
const PdfPrinter = require('pdfmake');
const {
  response,
  definedSchedules: definedSchedulesHelper,
  scheduleTemplates: scheduleTemplatesHelper,
  formatCurrency,
  countTotalSchedule,
  dateHelper,
  dateConverter
} = require('@helpers');
const fs = require('fs');
const config = require('config');

const {
  employees: Employee,
  users: User,
  companies: Company,
  presences: Presence,
  journals: Journal,
  journal_details: JournalDetail,
  salary_groups: SalaryGroups,
  allowance: Allowance
} = require('@models');

const pdfReport = {
  salarySlip: async (req, res) => {
    const { employee_id } = req.params;
    const { start, end } = req.query;
    try {
      const employee = await Employee.findOne({
        where: { id: employee_id },
        include: [
          {
            model: Presence,
            where: { presence_date: { $between: [start, end] } },
            order: [[Sequelize.col('presences.presence_date'), 'DESC']],
            required: false
          },
          { model: User, attributes: ['full_name'] },
          { model: Company, attributes: ['company_name'] },
          {
            model: SalaryGroups,
            attributes: [
              'salary_name',
              'use_bpjs',
              'bpjs_allowance',
              'jkk_allowance',
              'jkm_allowance',
              'jht_allowance',
              'jkk_reduction',
              'jkm_reduction',
              'jht_reduction'
            ],
            include: {
              model: Allowance,
              attributes: ['name', 'type', 'amount'],
              required: false
            }
          },
          {
            model: Journal,
            where: {
              $and: [
                Sequelize.where(
                  Sequelize.fn('DATE_FORMAT', Sequelize.col('journals.created_at'), '%Y-%m-%d'),
                  '>=',
                  start
                ),
                Sequelize.where(
                  Sequelize.fn('DATE_FORMAT', Sequelize.col('journals.created_at'), '%Y-%m-%d'),
                  '<=',
                  end
                )
              ]
            },
            attributes: [
              'type',
              'debet',
              'kredit',
              'include_lunch_allowance',
              'include_transport_allowance'
            ],
            required: false,
            include: [
              {
                model: JournalDetail,
                where: { status: 1 },
                attributes: ['total'],
                required: false
              },
              {
                model: SalaryGroups,
                attributes: [
                  'salary_name',
                  'use_bpjs',
                  'bpjs_allowance',
                  'jkk_allowance',
                  'jkm_allowance',
                  'jht_allowance',
                  'jkk_reduction',
                  'jkm_reduction',
                  'jht_reduction'
                ],
                include: {
                  model: Allowance,
                  attributes: ['name', 'type', 'amount'],
                  required: false
                }
              }
            ]
          }
        ]
      });

      if (!employee) {
        return res.status(400).json(response(false, 'Anggota tidak ditemukan', employee));
      }

      let absence = 0;
      let leave = 0;
      let holiday = 0;
      let permit = 0;
      let workday = 0;
      let totalReduction = 0;
      let totalIncome = 0;
      const startDate = new Date(start);
      const endDate = new Date(end);
      const rangedDate = `${startDate.getDate()} ${
        dateHelper[startDate.getMonth() + 1]
      } ${startDate.getFullYear()} - ${endDate.getDate()} ${
        dateHelper[endDate.getMonth() + 1]
      } ${endDate.getFullYear()}`;

      const totalSchedule = await countTotalSchedule(employee_id, start, end);
      employee.presences.forEach(data => {
        if (data.is_absence) absence++;
        if (data.is_leave) leave++;
        if (data.is_holiday) holiday++;
        if (data.is_permit) permit++;
        if (!data.is_absence && !data.is_leave && !data.is_holiday && !data.is_permit) workday++;
      });

      let bonus = 0;
      let fine = 0;
      let pph21 = 0;
      let employeeSalaryGroup = employee.journals.find(val => val.salary_group !== null);
      let employeeSalary = 0;
      let netSalary = 0;
      let withdraw = 0;
      let totalAllowance = 0;

      employee.journals.forEach(journal => {
        if (journal.type === 'other' && journal.debet) {
          bonus += journal.debet;
        }
        if (journal.type === 'other' && journal.kredit) {
          fine += journal.kredit;
        }
        if (journal.type === 'salary') {
          employeeSalary += journal.debet;
        }
        if (journal.type === 'withdraw') {
          withdraw += journal.journal_detail.total;
        }
        if (journal.type === 'allowance') {
          totalAllowance += journal.debet;
        }
      });

      totalIncome =
        employeeSalary +
        bonus +
        totalAllowance +
        employeeSalaryGroup.salary_group.bpjs_allowance +
        employeeSalaryGroup.salary_group.jkk_allowance +
        employeeSalaryGroup.salary_group.jkm_allowance +
        employeeSalaryGroup.salary_group.jht_allowance;
      totalReduction =
        fine +
        employeeSalaryGroup.salary_group.jkk_reduction +
        employeeSalaryGroup.salary_group.jkm_reduction +
        employeeSalaryGroup.salary_group.jht_reduction +
        pph21;
      netSalary = totalIncome - totalReduction;

      var fonts = {
        Roboto: {
          normal: 'fonts/Roboto-Regular.ttf',
          bold: 'fonts/Roboto-Medium.ttf',
          italics: 'fonts/Roboto-Italic.ttf',
          bolditalics: 'fonts/Roboto-MediumItalic.ttf'
        }
      };
      const printer = new PdfPrinter(fonts);
      const docDefinition = {
        styles: {
          content: {
            margin: [0, 5],
            fontSize: 15
          }
        },
        content: [
          {
            columns: [
              { text: employee.company.company_name, bold: true, style: 'content' },
              { text: 'Slip Gaji', bold: true, style: 'content' },
              ''
            ]
          },
          {
            table: {
              widths: ['*'],
              body: [[' '], [' ']]
            },
            layout: {
              hLineWidth: function(i, node) {
                return i === 0 || i === node.table.body.length ? 0 : 2;
              },
              vLineWidth: function(i, node) {
                return 0;
              }
            }
          },
          {
            columns: [
              { text: 'Nama', bold: true, style: 'content' },
              { text: employee.user.full_name, style: 'content' },
              ''
            ]
          },
          {
            columns: [
              { text: 'Periode', bold: true, style: 'content' },
              { text: rangedDate, style: 'content' },
              ''
            ]
          },
          {
            columns: [
              { text: 'Hari Kerja', bold: true, style: 'content' },
              { text: `${workday} Hari`, style: 'content' },
              ''
            ]
          },
          {
            columns: [
              { text: 'Libur', bold: true, style: 'content' },
              { text: `${holiday} Hari`, style: 'content' },
              ''
            ]
          },
          {
            columns: [
              { text: 'Cuti', bold: true, style: 'content' },
              { text: `${leave} Hari`, style: 'content' },
              ''
            ]
          },
          {
            columns: [
              { text: 'Ada Jadwal, Tidak Ceklok', bold: true, style: 'content' },
              {
                text: `${totalSchedule - workday - leave - holiday - absence - permit} Hari`,
                style: 'content'
              },
              ''
            ]
          },
          {
            columns: [
              { text: 'Tidak Hadir', bold: true, style: 'content' },
              { text: `${absence} Hari`, style: 'content' },
              ''
            ]
          },
          {
            columns: [
              { text: 'Gaji Diterima', bold: true, style: 'content' },
              { text: 'IDR', bold: true, style: 'content' },
              { text: `Rp. ${formatCurrency(netSalary)}`, bold: true, style: 'content' }
            ]
          },
          { text: 'Pendapatan', bold: true, style: 'content' },
          {
            columns: [
              { text: 'Gaji Pokok', style: 'content' },
              { text: 'IDR', style: 'content' },
              { text: `Rp. ${formatCurrency(employeeSalary)}`, style: 'content' }
            ]
          },
          {
            columns: [
              { text: 'Bonus', style: 'content' },
              { text: 'IDR', style: 'content' },
              { text: `Rp. ${formatCurrency(bonus)}`, style: 'content' }
            ]
          },
          {
            columns: [
              { text: 'Tunjangan Harian', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(totalAllowance)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'BPJS', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employeeSalaryGroup.salary_group.bpjs_allowance || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'JKK', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employeeSalaryGroup.salary_group.jkk_allowance || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'JKM', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employeeSalaryGroup.salary_group.jkm_allowance || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'JHT', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employeeSalaryGroup.salary_group.jht_allowance || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            table: {
              widths: ['*'],
              body: [[' '], [' ']]
            },
            layout: {
              hLineWidth: function(i, node) {
                return i === 0 || i === node.table.body.length ? 0 : 2;
              },
              vLineWidth: function(i, node) {
                return 0;
              }
            }
          },
          {
            columns: [
              { text: 'Total Pendapatan', bold: true, style: 'content' },
              { text: 'IDR', bold: true, style: 'content' },
              { text: `Rp. ${formatCurrency(totalIncome)}`, bold: true, style: 'content' }
            ]
          },
          { text: 'Deduksi', bold: true, style: 'content' },
          {
            columns: [
              { text: 'Potongan', style: 'content' },
              { text: 'IDR', style: 'content' },
              { text: `Rp. ${formatCurrency(fine)}`, style: 'content' }
            ]
          },
          {
            columns: [
              { text: 'Tarikan GajianDulu', style: 'content' },
              { text: 'IDR', style: 'content' },
              { text: `Rp. ${formatCurrency(withdraw)}`, style: 'content' }
            ]
          },
          {
            columns: [
              { text: 'JKK', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employeeSalaryGroup.salary_group.jkk_reduction || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'JKM', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employeeSalaryGroup.salary_group.jkm_reduction || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'JHT', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employeeSalaryGroup.salary_group.jht_reduction || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'PPh21', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(pph21 || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            table: {
              widths: ['*'],
              body: [[' '], [' ']]
            },
            layout: {
              hLineWidth: function(i, node) {
                return i === 0 || i === node.table.body.length ? 0 : 2;
              },
              vLineWidth: function(i, node) {
                return 0;
              }
            }
          },
          {
            columns: [
              { text: 'Total Deduksi', bold: true, style: 'content' },
              { text: 'IDR', bold: true, style: 'content' },
              { text: `Rp. ${formatCurrency(totalReduction)}`, bold: true, style: 'content' }
            ]
          }
        ]
      };
      const host =
        process.env.NODE_ENV !== 'production'
          ? `http://${config.host}:${config.port}`
          : `https://${config.host}`;
      const fileName = `${Date.now()}-${employee.user.full_name.split(' ').slice(0, 1)}.pdf`;
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      pdfDoc.pipe(fs.createWriteStream(`public/documents/${fileName}`));
      pdfDoc.end();
      const payload = {
        url: `${host}/documents/${fileName}`
      };
      return res.status(200).json(response(true, 'Slip gaji berhasil dibuat', payload));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  progressiveSalary: async (req, res) => {
    const { employee_id } = req.params;
    const { start, end } = req.query;
    try {
      const employee = await Employee.findOne({
        where: { id: employee_id },
        include: [
          {
            model: Presence,
            where: {
              presence_date: { $between: [start, end] }
            },
            required: false,
            order: [[Sequelize.col('presences.presence_date'), 'ASC']]
          },
          { model: User, attributes: ['full_name'] },
          { model: Company, attributes: ['company_name', 'id'] },
          {
            model: SalaryGroups,
            required: false,
            attributes: [
              'salary_name',
              'salary_type',
              'use_bpjs',
              'salary',
              'bpjs_allowance',
              'jkk_allowance',
              'jkm_allowance',
              'jht_allowance',
              'jkk_reduction',
              'jkm_reduction',
              'jht_reduction'
            ],
            include: {
              model: Allowance,
              attributes: ['name', 'type', 'amount'],
              required: false
            }
          },
          {
            model: Journal,
            where: [
              {},
              Sequelize.where(
                Sequelize.fn('DATE_FORMAT', Sequelize.col('journals.created_at'), '%Y-%m-%d'),
                '>=',
                start
              ),
              Sequelize.where(
                Sequelize.fn('DATE_FORMAT', Sequelize.col('journals.created_at'), '%Y-%m-%d'),
                '<=',
                end
              )
            ],
            attributes: [
              'type',
              'debet',
              'kredit',
              'created_at',
              'include_lunch_allowance',
              'include_transport_allowance'
            ],
            order: ['created_at', 'ASC'],
            required: false
          }
        ]
      });
      if (!employee) {
        return res.status(400).json(response(false, 'Anggota tidak ditemukan'));
      }
      if (!employee.salary_groups.length) {
        return res
          .status(400)
          .json(response(false, 'Tidak bisa melihat slip gaji jika tidak memiliki golongan gaji'));
      }

      let workday = employee.presences.length;
      let netSalary = 0;
      const startDate = new Date(start);
      const endDate = new Date(end);
      const rangedDate = `${startDate.getDate()} ${
        dateHelper[startDate.getMonth() + 1]
      } ${startDate.getFullYear()} - ${endDate.getDate()} ${
        dateHelper[endDate.getMonth() + 1]
      } ${endDate.getFullYear()}`;

      let schedules = [];
      employee.presences = employee.presences.sort((a, b) => {
        return new Date(a.presence_date) - new Date(b.presence_date);
      });
      let employeeSalaryGroup = employee.salary_groups[0];

      let monthlyAllowance = 0;
      employee.journals.forEach(val => {
        if (val.type === 'monthlyAllowance' && val.debet > 0) {
          monthlyAllowance += val.debet;
        }
      });
      employee.presences.forEach(data => {
        let bonus = 0;
        let fine = 0;
        let employeeSalary = 0;
        let totalAllowance = 0;
        let total = 0;
        let date = new Date(data.presence_date);
        date = `${date.getDate()} ${dateHelper[date.getMonth() + 1]} ${date.getFullYear()}`;

        const journals = employee.journals.filter(
          journal => data.presence_date === dateConverter(journal.created_at)
        );
        // eslint-disable-next-line no-console
        journals.forEach(journal => {
          if (journal.type === 'other' && journal.debet > 0) {
            bonus += journal.debet;
          }
          if (journal.type === 'other' && journal.kredit > 0) {
            fine += journal.kredit;
          }

          if (journal.type === 'salary') {
            if (journal.include_lunch_allowance && journal.include_transport_allowance) {
              employeeSalaryGroup.allowances.filter(allowance => {
                if (allowance.type === 1) {
                  totalAllowance += allowance.amount;
                }
              });
              employeeSalary += journal.debet - totalAllowance;
            } else {
              employeeSalary += journal.debet;
            }
          }
        });
        total = employeeSalary + totalAllowance + bonus - fine;
        netSalary += total;

        const schedule = [
          { text: `${date}`, style: 'content' },
          {
            columns: [
              { text: 'Gaji Pokok', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `${formatCurrency(employeeSalary)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'Tunjangan Harian', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `${formatCurrency(totalAllowance)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'Potongan', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `(${formatCurrency(fine)})`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'Bonus', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `${formatCurrency(bonus)}`,
                style: 'content'
              }
            ]
          }
        ];
        schedules.push(schedule);
      });

      var fonts = {
        Roboto: {
          normal: 'fonts/Roboto-Regular.ttf',
          bold: 'fonts/Roboto-Medium.ttf',
          italics: 'fonts/Roboto-Italic.ttf',
          bolditalics: 'fonts/Roboto-MediumItalic.ttf'
        }
      };
      const printer = new PdfPrinter(fonts);
      const docDefinition = {
        styles: {
          content: {
            margin: [0, 5],
            fontSize: 15
          }
        },
        content: [
          {
            columns: [
              { text: employee.company.company_name, bold: true, style: 'content' },
              { text: 'Gaji Berjalan', bold: true, style: 'content' },
              ''
            ]
          },
          {
            table: {
              widths: ['*'],
              body: [[' '], [' ']]
            },
            layout: {
              hLineWidth: function(i, node) {
                return i === 0 || i === node.table.body.length ? 0 : 2;
              },
              vLineWidth: function(i, node) {
                return 0;
              }
            }
          },
          {
            columns: [
              { text: 'Nama', bold: true, style: 'content' },
              { text: employee.user.full_name, style: 'content' },
              ''
            ]
          },
          {
            columns: [
              { text: 'Periode Mulai', bold: true, style: 'content' },
              { text: rangedDate, style: 'content' },
              ''
            ]
          }
        ]
      };

      let salaryType =
        parseInt(employeeSalaryGroup.salary_type, 0) === 1 ? 'Bulanan' : 'Per Hari Kerja';
      let salaryTypeColumn;

      if (parseInt(employeeSalaryGroup.salary_type, 0) === 1) {
        salaryTypeColumn = {
          columns: [
            { text: 'Tipe Gaji Pokok', bold: true, style: 'content' },
            {
              text: `${salaryType} - Rp. ${formatCurrency(employeeSalaryGroup.salary)}`,
              style: 'content'
            },
            ''
          ]
        };
      } else if (parseInt(employeeSalaryGroup.salary_type, 0) === 2) {
        salaryTypeColumn = [
          {
            columns: [
              { text: 'Tipe Gaji Pokok', bold: true, style: 'content' },
              {
                text: `${salaryType}`,
                style: 'content'
              },
              ''
            ]
          }
        ];
        let arrayDate = [];
        arrayDate = [];
        while (startDate <= endDate) {
          arrayDate.push(
            `${startDate.getFullYear()}-${('0' + (startDate.getMonth() + 1)).slice(-2)}-${(
              '0' + startDate.getDate()
            ).slice(-2)}`
          );
          startDate.setDate(startDate.getDate() + 1);
        }
        const scheduleRanged = [];
        for (let i = 0; i < arrayDate.length; i++) {
          let schedule = [];
          schedule = await scheduleTemplatesHelper(
            arrayDate[i],
            employee_id,
            employee.company.id,
            true
          );
          if (!schedule.length) {
            schedule = await definedSchedulesHelper(arrayDate[i], employee.company.id, employee_id);
          }
          if (schedule.length && schedule[0].shift) {
            const compose = schedule[0];
            Object.assign(compose.dataValues, { date: arrayDate[i] });
            scheduleRanged.push(compose);
          }
        }

        let employeeSchedules = [];
        scheduleRanged.forEach(schedule => {
          const index = employee.presences.findIndex(
            presence =>
              new Date(presence.presence_date).getTime() ===
              // eslint-disable-next-line no-undef
              new Date(schedule.dataValues.date).getTime()
          );
          if (index !== -1) {
            employeeSchedules.push(schedule);
          }
        });

        let shifts = [];
        employeeSchedules.forEach(schedule => {
          const index = shifts.findIndex(shift => shift.id === schedule.shift.schedule_shift.id);
          if (index === -1) {
            shifts.push(schedule.shift.schedule_shift);
          }
        });
        shifts.forEach(shift => {
          let shiftColumn = {
            columns: [
              '',
              { text: `${shift.shift_name}`, style: 'content' },
              {
                text: `Rp. ${formatCurrency(shift.salary)}`,
                style: 'content'
              }
            ]
          };
          salaryTypeColumn.push(shiftColumn);
        });
      }
      docDefinition.content.push(salaryTypeColumn);
      docDefinition.content.push(
        {
          columns: [
            { text: 'Gaji Berjalan', bold: true, style: 'content' },
            { text: 'IDR', style: 'content' },
            {
              text: `${formatCurrency(netSalary)}`,
              style: 'content'
            }
          ]
        },
        {
          columns: [
            { text: 'Tunjangan Bulanan', bold: true, style: 'content' },
            { text: 'IDR', style: 'content' },
            {
              text: `${formatCurrency(monthlyAllowance)}`,
              style: 'content'
            }
          ]
        },
        {
          columns: [
            { text: 'Hari Kerja', bold: true, style: 'content' },
            '',
            { text: `${workday}`, style: 'content' }
          ]
        },
        { text: 'Riwayat', bold: true, style: 'content' }
      );
      schedules.forEach(schedule => {
        docDefinition.content.push(schedule);
      });

      docDefinition.content.push({
        columns: [
          { text: 'Total Gaji Berjalan', bold: true, style: 'content' },
          { text: 'IDR', bold: true, style: 'content' },
          { text: `${formatCurrency(netSalary + monthlyAllowance)}`, bold: true, style: 'content' }
        ]
      });

      const host =
        process.env.NODE_ENV !== 'production'
          ? `http://${config.host}:${config.port}`
          : `https://${config.host}`;
      const fileName = `${Date.now()}-${employee.user.full_name.split(' ').slice(0, 1)}.pdf`;
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      pdfDoc.pipe(fs.createWriteStream(`public/documents/${fileName}`));
      pdfDoc.end();
      const payload = {
        url: `${host}/documents/${fileName}`
      };
      return res.status(200).json(response(true, 'Gaji berjalan berhasil dibuat', payload));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = pdfReport;

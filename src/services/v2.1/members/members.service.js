require('module-alias/register');
const crypt = require('bcrypt');
const Excel = require('exceljs');
const ReadExcel = require('node-xlsx');
const Sequelize = require('sequelize');
const PdfPrinter = require('pdfmake');
const { Op } = Sequelize;
const {
  nodemailerMail,
  mailTemplates,
  response,
  dateProcessor,
  definedSchedules: definedSchedulesHelper,
  presences: presencesHelper,
  scheduleTemplates: scheduleTemplatesHelper,
  countWorkdays,
  formatCurrency,
  countTotalSchedule,
  dateHelper,
  dateConverter
} = require('@helpers');
const fs = require('fs');
const path = require('path');
const config = require('config');

const {
  employees: Employee,
  users: User,
  companies: Company,
  presences: Presence,
  salary_details: SalaryDetails,
  journals: Journal,
  journal_details: JournalDetail,
  digital_assets: DigitalAsset,
  employee_notes: EmployeeNote,
  company_settings: CompanySetting,
  salary_groups: SalaryGroups,
  division_details: DivisionDetails,
  divisions: Divisions,
  employee_pph21: EmployeePph21,
  ptkp_details: PtkpDetails,
  employee_verifs: EmployeeVerifs,
  cron_members_salary_groups: CronMembersSalaryGroup,
  cron_employees: CronEmployees,
  allowance: Allowance
} = require('@models');

const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const memberService = {
  getDetail: async (req, res) => {
    const { employee_id } = req.params;
    const { dateStart, dateEnd } = req.query;
    try {
      const employee = await Employee.findOne({
        where: { id: employee_id },
        include: [
          {
            model: User,
            attributes: ['full_name', 'email', 'phone', 'id']
          },
          {
            model: Company,
            include: [{ model: CompanySetting, as: 'setting' }]
          },
          {
            model: SalaryGroups
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

      // Generate All Date in a month based on payroll date
      let arrayDate = [];
      const rangedDate = dateProcessor.getRangedDate(employee.company.setting.payroll_date);
      // Generate All Date in a month based on given ranged date
      arrayDate = [];
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
      const scheduleRanged = [];
      for (let i = 0; i < arrayDate.length; i++) {
        let schedule = [];
        schedule = await scheduleTemplatesHelper(
          arrayDate[i],
          employee.id,
          employee.company_id,
          true
        );
        if (!schedule.length) {
          schedule = await definedSchedulesHelper(arrayDate[i], employee.company_id, employee.id);
        }
        if (schedule.length && schedule[0].shift) {
          const compose = schedule[0];
          Object.assign(compose.dataValues, { date: arrayDate[i] });
          scheduleRanged.push(compose);
        }
      }

      const {
        id: employeeId,
        role,
        salary,
        workdays,
        daily_salary,
        flag,
        user,
        assets,
        meal_allowance
      } = employee;
      const { full_name, email, phone } = user;

      let presenceData = await Presence.findAll({
        where: [
          {
            employee_id: employeeId,
            presence_date: {
              [Op.gte]: dateStart,
              [Op.lte]: dateEnd
            },
            custom_presence: 0
          }
        ],
        order: [['presence_date', 'ASC']],
        attributes: {
          exclude: ['employee_id', 'checkin_location', 'checkout_location', 'updated_at']
        }
      });

      let journalData = await Journal.findAll({
        where: [
          {
            type: {
              $notIn: ['withdraw', 'subscribe', 'payment']
            },
            on_hold: 0
          },
          { employee_id: employeeId },
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
            '>=',
            dateStart
          ),
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
            '<=',
            dateEnd
          )
        ],
        attributes: ['type', 'debet', 'kredit', 'description', 'created_at']
      });
      const withdrawData = await JournalDetail.findAll({
        include: {
          model: Journal,
          attributes: ['type', 'employee_id', 'description'],
          where: [
            { employee_id: employeeId, type: 'withdraw' },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('journal_details.created_at'), '%Y-%m-%d'),
              '>=',
              dateStart
            ),
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('journal_details.created_at'), '%Y-%m-%d'),
              '<=',
              dateEnd
            )
          ]
        }
      });
      const nonSalaryJournal = await Journal.findOne({
        where: [
          { employee_id: employeeId, type: ['notes', 'other', 'fine', 'periodic'] },
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
            '>=',
            dateStart
          ),
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
            '<=',
            dateEnd
          )
        ],
        attributes: [
          [Sequelize.fn('SUM', Sequelize.col('debet')), 'bonus'],
          [Sequelize.fn('SUM', Sequelize.col('kredit')), 'penalty']
        ]
      });
      const employeeNotes = await EmployeeNote.findAll({
        where: [
          {
            employee_id: employeeId,
            date: {
              [Op.gte]: dateStart,
              [Op.lte]: dateEnd
            }
          }
        ]
      });

      let monthlyPresence = [];
      let totalWorkhour = 0;
      let totalFreqPresenceOverdue = 0;
      let totalPresenceOverdue = 0;
      let totalOverwork = 0;
      let workday = 0;
      let debit = 0;
      let debitWithoutBonus = 0;
      let credit = 0;
      let creditProgressive = 0;
      for (let i = 0; i < presenceData.length; i++) {
        let specificJournalData = await Journal.findAll({
          where: [
            {
              $not: {
                type: 'withdraw'
              }
            },
            { employee_id: employeeId },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
              `${presenceData[i].presence_date}`
            )
          ],
          attributes: ['type', 'debet', 'kredit', 'description', 'created_at']
        });
        totalWorkhour += presenceData[i].work_hours;
        totalFreqPresenceOverdue += presenceData[i].presence_overdue ? 1 : 0;
        totalPresenceOverdue += presenceData[i].presence_overdue;
        totalOverwork += presenceData[i].overwork;
        !presenceData[i].is_absence && workday++;
        presenceData[i].dataValues['journals'] = specificJournalData;
        monthlyPresence.push(presenceData[i]);
      }

      journalData.map(val => {
        if (val.type === 'salary' || val.type === 'periodic') debitWithoutBonus += val.debet;
        if (val.type === 'periodic' || val.type === 'other') {
          creditProgressive += val.kredit;
        }
        debit += val.debet;
        credit += val.kredit;
      });

      let employeePresences = 0;
      let notCheckLog = 0;

      let scheduleRangedUntilToday = scheduleRanged.filter(
        date => new Date(date.dataValues.date) <= new Date()
      );
      let employeeSchedule = scheduleRangedUntilToday.length;

      let presences = await presencesHelper(new Date(rangedDate.dateStart), employee.id);
      for (const schedule of scheduleRangedUntilToday) {
        const scheduleDate = schedule.dataValues.date;
        const empPresences = presences.filter(
          date => new Date(date.presence_date).getTime() === new Date(scheduleDate).getTime()
        );
        if (empPresences.length > 0) {
          employeePresences++;
        }
      }

      notCheckLog = employeeSchedule - employeePresences;

      /**
       * Net Salary / Gaji Diterima Formula
       * Bonus Berkala (Periodic Bonus) - Potongan Berkala (Periodic Penalty) + Gaji Pokok Pro Rate + Tot Tj. Harian (Daily Allowance) + Tj. Bulanan (Monthly Allowance) [Hitung di tanggal tutup buku] + Tot Bonus + - Tot Potongan + Pendapatan BPJS [Hitung di tanggal tutup buku] - Deduksi BPJS [Hitung di tanggal tutup buku] - PPh21 [Hitung di tanggal tutup buku] - Tarikan GD
       */

      /**
       * Progressive Salary / Gaji Berjalan Formula
       * Bonus Berkala (Periodic Bonus) - Potongan Berkala (Periodic Penalty) + Gaji Pokok Pro Rate + Tj. Harian (Daily Allowance) - Total Potongan (Total Penalty)
       */

      let nett_salary = debit - credit;
      let progressiveSalary = debitWithoutBonus - creditProgressive;
      let withdraws = 0;
      let grossWithdraws = 0;
      const mtdGrossSalary = nett_salary;

      if (withdrawData.length > 0) {
        for (let i = 0; i < withdrawData.length; i++) {
          if (withdrawData[i].status.toString() === '1') {
            withdraws += withdrawData[i].total;
            grossWithdraws += withdrawData[i].total;
          }
        }
      }

      nett_salary = nett_salary - grossWithdraws;

      let totalWorkDays = 0;
      if (employee.salary_groups.length) {
        let daily_frequent = employee.salary_groups[0].daily_frequent;
        if (daily_frequent) {
          totalWorkDays = countWorkdays(daily_frequent, rangedDate.dateStart, rangedDate.dateEnd);
        } else {
          totalWorkDays = await countTotalSchedule(
            employee_id,
            rangedDate.dateStart,
            rangedDate.dateEnd
          );
        }
      }
      const salary_summary = {
        bonus: nonSalaryJournal.dataValues.bonus,
        penalty: nonSalaryJournal.dataValues.penalty,
        nett_salary,
        progressive_salary: progressiveSalary,
        mtd_gross_salary: mtdGrossSalary,
        monthly_gross_salary: salary,
        workhour: totalWorkhour
      };
      const memberData = {
        user_id: employee.user.id,
        id: employeeId,
        full_name,
        email,
        phone,
        flag,
        role,
        company: employee.company,
        date_start_work: employee.date_start_work,
        date_end_work: employee.date_end_work,
        salary: employee.salary_groups.length ? employee.salary_groups[0].salary_name : salary,
        salary_id: employee.salary_groups.length ? employee.salary_groups[0].id : null,
        workdays: totalWorkDays ? totalWorkDays : workdays,
        schedule_ranged: scheduleRanged,
        division: employee.division_details,
        daily_salary,
        withdraws,
        employee_notes: employeeNotes.filter(val => val.type === null),
        bonus_note: employeeNotes.filter(val => val.type === 1),
        penalty_note: employeeNotes.filter(val => val.type === 2),
        salary_summary: salary_summary,
        presences: monthlyPresence,
        yearly_presences: [],
        assets,
        not_check_log: notCheckLog,
        meal_allowance,
        salary_groups: employee.salary_groups.length ? employee.salary_groups[0] : null,
        salary_type: employee.salary_type,
        pph21: employee.employee_pph21s.length ? employee.employee_pph21s : null,
        leave_remaining: employee.leave,
        total_workhour: totalWorkhour,
        total_freq_presence_overdue: totalFreqPresenceOverdue,
        total_presence_overdue: totalPresenceOverdue,
        total_overwork: totalOverwork
      };

      return res
        .status(200)
        .json(response(true, 'Member detail been successfully retrieved', memberData));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  createMember: async (req, res) => {
    const { data } = req.body;
    const { company_id } = req.params;
    const { id, employeeId } = res.local.users;
    try {
      const userData = await User.findOne({ where: { id } });
      const companyData = await Company.findOne({ where: { id: company_id } });
      if (!companyData) {
        return res
          .status(400)
          .json(response(false, `Company with parameter id ${company_id} not found`));
      }
      const emailExist = await User.findOne({
        where: { email: data.email }
      });
      if (emailExist) {
        const employeePayload = {
          company_id,
          user_id: emailExist.id,
          role: data.role,
          salary_type: data.salaryType,
          flag: 1,
          active: 1,
          date_start_work: data.dateStartWork
        };
        let employee = await Employee.findOne({
          where: { user_id: emailExist.id }
        });
        let employeePph21Payload = {};
        Object.assign(employeePph21Payload, data.pph21);
        if (!employee) {
          employee = await Employee.create(employeePayload);
          if (data.salaryId) {
            const salaryDetailsPayload = {
              employee_id: employee.id,
              salary_id: data.salaryId
            };
            await SalaryDetails.create(salaryDetailsPayload);
          }
          if (data.pph21) {
            employeePph21Payload.employee_id = employee.id;
            await EmployeePph21.create(employeePph21Payload);
          }
        } else {
          if (employee.flag.toString() === '3') {
            return res
              .status(400)
              .json(response(false, 'Email terdaftar sudah masuk ke perusahaan'));
          }
          if (employee.flag.toString() === '2') {
            return res
              .status(400)
              .json(response(false, 'Anggota sudah melakukan permintaan gabung ke tim'));
          }
          await Employee.update(employeePayload, { where: { user_id: emailExist.id } });
          if (data.salaryId) {
            await SalaryDetails.update(
              { salary_id: data.salaryId },
              { where: { employee_id: employee.id } }
            );
          }
          if (data.pph21)
            await EmployeePph21.update(employeePph21Payload, {
              where: { employee_id: employee.id }
            });
          else await EmployeePph21.destroy({ where: { employee_id: employee.id } });
        }
        // SEND NOTIFICATION TO MANAGERS
        const description = `${userData.full_name} telah mengundang seorang anggota baru bernama ${data.name}`;
        observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
          employeeId,
          description
        });
        /* eslint-disable indent */
        nodemailerMail.sendMail(
          {
            from: 'cs@atenda.id',
            to: emailExist.email, // An array if you have multiple recipients.
            subject: `Undangan Anggota ${companyData.name} - GajianDulu`,
            //You can use "html:" to send HTML email content. It's magic!
            html: mailTemplates.managerInviting({ companyData, data })
          },
          function(err, info) {
            if (err) {
              let errorLog = new Date().toISOString() + ' [Manager Inviting]: ' + err + '\n';
              global.emailErrorLog.write(errorLog);
              return res
                .status(400)
                .json(response(false, 'Failed to send email, please invite member again', err));
            } else {
              return res.status(201).json(response(true, 'Calon member telah berhasil diundang'));
            }
          }
        );
        /* eslint-enable */
      } else {
        const hash = crypt.hashSync(new Date().toString() + data.email, 10);
        const payloadUser = Object.assign(
          {},
          { full_name: data.name, email: data.email, phone: data.phone, hash }
        );
        const userCreated = await User.create(payloadUser);

        const payloadEmployee = Object.assign(
          {},
          {
            company_id,
            user_id: userCreated.id,
            salary_type: data.salaryType,
            role: data.role,
            flag: 1,
            date_start_work: data.dateStartWork
          }
        );
        const employee = await Employee.create(payloadEmployee);
        if (data.salaryId) {
          const salaryDetailsPayload = {
            employee_id: employee.id,
            salary_id: data.salaryId
          };
          await SalaryDetails.create(salaryDetailsPayload);
        }
        let employeePph21Payload = {};
        Object.assign(employeePph21Payload, data.pph21);
        if (data.pph21) {
          employeePph21Payload.employee_id = employee.id;
          await EmployeePph21.create(employeePph21Payload);
        }
        // SEND NOTIFICATION TO MANAGERS
        const description = `${userData.full_name} telah mengundang seorang anggota baru bernama ${data.name}`;
        observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
          employeeId,
          description
        });
        /* eslint-disable indent */
        nodemailerMail.sendMail(
          {
            from: 'cs@atenda.id',
            to: data.email, // An array if you have multiple recipients.
            subject: `Member Invitation GajianDulu - ${companyData.name}`,
            //You can use "html:" to send HTML email content. It's magic!
            html: mailTemplates.managerInviting({ companyData, data })
          },
          function(err, info) {
            if (err) {
              let errorLog = new Date().toISOString() + ' [Member Invited]: ' + err + '\n';
              global.emailErrorLog.write(errorLog);
              return res
                .status(400)
                .json(response(false, 'Failed to send email, please invite member again', err));
            } else {
              return res
                .status(201)
                .json(response(true, 'User telah dibuat dan Member telah berhasil diundang'));
            }
          }
        );
      }
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  editMember: async (req, res) => {
    const { data } = req.body;
    const { employee_id: employeeId } = req.params;
    const { id, employeeId: currentEmployeeId } = res.local.users;
    let isCronActive = false;
    try {
      const employee = await Employee.findOne({
        where: { id: employeeId },
        include: [
          { model: User, attributes: ['id', 'full_name'] },
          { model: SalaryGroups, required: false },
          { model: CronEmployees, required: false }
        ]
      });
      if (!employee) {
        return res.status(400).json(response(false, 'Member tidak ditemukan'));
      }
      const userData = await User.findOne({ where: { id } });
      //count role manager
      var countRole = await Employee.findAll({
        where: { role: { [Op.like]: 1 }, company_id: employee.company_id }
      });
      //condition for check total manager
      if (data.role != 1 && countRole.length == 1 && employeeId == countRole[0].id) {
        return res
          .status(400)
          .json(response(false, 'Minimal terdapat satu manajer dalam suatu tim'));
      }
      let payload = {
        full_name: data.full_name,
        email: data.email,
        phone: data.phone
      };
      const editUser = await User.update(payload, { where: { id: employee.user.id } });
      if (!editUser) {
        return res.status(400).json(response(false, 'Gagal mengubah data member'));
      }
      payload = {
        role: data.role,
        salary_type: data.salaryType,
        date_start_work: data.dateStartWork
      };
      const editEmployee = await Employee.update(payload, { where: { id: employeeId } });
      if (!editEmployee) {
        return res.status(400).json(response(false, 'Gagal mengubah data member'));
      }

      if (employee.salary_groups.length) {
        if (employee.salary_groups[0].id !== data.salaryGroupId) {
          const isCronSalaryGroupExist = await CronMembersSalaryGroup.findOne({
            where: { employee_id: employeeId }
          });
          if (isCronSalaryGroupExist) {
            await CronMembersSalaryGroup.update(
              { salary_id: data.salaryGroupId },
              { where: { id: isCronSalaryGroupExist.id } }
            );
          } else {
            await CronMembersSalaryGroup.create({
              employee_id: employeeId,
              salary_id: data.salaryGroupId
            });
          }
          isCronActive = true;
        }
      } else {
        await SalaryDetails.create({ employee_id: employeeId, salary_id: data.salaryGroupId });
      }

      if (employee.company_id !== data.company_id) {
        const isCronEmployeeExist = await CronEmployees.findOne({
          where: { employee_id: employeeId }
        });
        if (isCronEmployeeExist) {
          await CronEmployees.update(
            { company_id: data.company_id },
            { where: { id: isCronEmployeeExist.id } }
          );
        } else {
          await CronEmployees.create({ employee_id: employeeId, company_id: data.company_id });
        }
        isCronActive = true;
      }

      const isPph21Exist = await EmployeePph21.findOne({ where: { employee_id: employeeId } });
      if (data.pph21 && isPph21Exist) {
        await EmployeePph21.update(data.pph21, { where: { employee_id: employeeId } });
      } else if (data.pph21 && !isPph21Exist) {
        await EmployeePph21.create({ ...data.pph21, employee_id: employeeId });
      }
      if (!data.pph21 && isPph21Exist) {
        await EmployeePph21.destroy({ where: { employee_id: employeeId } });
      }
      // SEND NOTIFICATION TO MANAGERS
      const description = `${userData.full_name} telah mengedit data anggota ${employee.user.full_name}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId: currentEmployeeId,
        description
      });
      if (isCronActive)
        return res
          .status(201)
          .json(
            response(
              true,
              'Data member berhasil diubah. Perubahan data seperti golongan gaji atau lokasi tim akan diterapkan pada saat periode baru dimulai (tanggal buka buku)',
              null,
              { useAlert: true }
            )
          );
      else
        return res
          .status(201)
          .json(response(true, 'Data member berhasil diubah', null, { useAlert: false }));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
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
            include: {
              model: JournalDetail,
              where: { status: 1 },
              attributes: ['total'],
              required: false
            }
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
      let dailyAllowance = 0;
      let pph21 = 0;
      let employeeSalaryGroup = employee.salary_groups[0];
      let employeeSalary = 0;
      let netSalary = 0;
      let withdraw = 0;

      employee.journals.forEach(journal => {
        if (journal.type === 'other' && journal.debet) {
          bonus += journal.debet;
        }
        if (journal.type === 'other' && journal.kredit) {
          fine += journal.kredit;
        }
        if (journal.type === 'salary') {
          if (journal.include_lunch_allowance && journal.include_transport_allowance) {
            let totalAllowance = 0;
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

        if (journal.type === 'withdraw') {
          withdraw += journal.journal_detail.total;
        }
      });
      employeeSalaryGroup.allowances.forEach(allowance => {
        if (allowance.type === 1) {
          dailyAllowance += allowance.amount * workday;
        }
      });

      totalIncome =
        employeeSalary +
        bonus +
        dailyAllowance +
        employeeSalaryGroup.bpjs_allowance +
        employeeSalaryGroup.jkk_allowance +
        employeeSalaryGroup.jkm_allowance +
        employeeSalaryGroup.jht_allowance;
      totalReduction =
        fine +
        employeeSalaryGroup.jkk_reduction +
        employeeSalaryGroup.jkm_reduction +
        employeeSalaryGroup.jht_reduction +
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
                text: `Rp. ${formatCurrency(dailyAllowance)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'BPJS', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employeeSalaryGroup.bpjs_allowance || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'JKK', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employeeSalaryGroup.jkk_allowance || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'JKM', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employeeSalaryGroup.jkm_allowance || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'JHT', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employeeSalaryGroup.jht_allowance || 0)}`,
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
                text: `Rp. ${formatCurrency(employeeSalaryGroup.jkk_reduction || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'JKM', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employeeSalaryGroup.jkm_reduction || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'JHT', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employeeSalaryGroup.jht_reduction || 0)}`,
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
  },
  createConfirmationInfo: async (req, res) => {
    const { employee_id: employeeId } = req.params;
    try {
      const host =
        process.env.NODE_ENV !== 'production'
          ? `http://${config.host}:${config.port}/`
          : `https://${config.host}/`;

      let location;

      let payload = {
        type: req.body.type,
        uploadable_id: req.body.uploadable_id || null,
        uploadable_type: req.body.uploadable_type
      };

      // This will handle file as encoded base64 from client
      if (!req.file) {
        const base64Data = req.body.file.replace(/^data:image\/png;base64,/, '');
        const filename = Date.now() + '.png';

        location = path.join(__dirname + '/../../../public/uploads/' + filename);

        fs.writeFile(location, base64Data, 'base64', error => {
          if (error) {
            return new Error('Something went wrong when save your image!');
          }
        });
        payload['filename'] = filename;
        payload['mime_type'] = 'image/png';
        payload['path'] = 'public/uploads/' + filename;
        payload['url'] = host + 'uploads/' + filename;
      }

      // This will handle file as blob from client
      if (req.file) {
        location = req.file.path.split('/')[1];

        payload['path'] = req.file.path;
        payload['filename'] = req.file.filename;
        payload['mime_type'] = req.file.mimetype;
        payload['url'] = `${host}${location}/${req.file.filename}`;
      }
      if (req.body.uploadable_id) {
        const employeeVerif = await EmployeeVerifs.update(
          { status: 0 },
          { where: { id: req.body.uploadable_id } }
        );
        if (!employeeVerif)
          return res.status(400).json(response(false, 'Gagal mengunggah dokumen'));
        const photo = await DigitalAsset.update(payload, {
          where: {
            type: 'confirmation',
            uploadable_type: 'employee_verifs',
            uploadable_id: req.body.uploadable_id
          }
        });
        if (!photo) return res.status(400).json(response(false, 'Gagal mengunggah dokumen'));
      }
      if (!req.body.uploadable_id) {
        const employeeVerif = await EmployeeVerifs.create({
          employee_id: employeeId,
          status: 0
        });
        if (!employeeVerif)
          return res.status(400).json(response(false, 'Gagal mengunggah dokumen'));
        payload.uploadable_id = employeeVerif.id;
        const photo = await DigitalAsset.create(payload);
        if (!photo) return res.status(400).json(response(false, 'Gagal mengunggah dokumen'));
      }
      return res.status(201).json(response(true, 'Data konfirmasi informasi berhasil diunggah'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  confirmationInfo: async (req, res) => {
    const { employee_id: employeeId } = req.params;
    try {
      const employee = await Employee.findOne({ where: { id: employeeId } });
      if (!employee) {
        return res.status(400).json(response(false, 'Anggota tidak ditemukan'));
      }
      const employeeVerif = await EmployeeVerifs.findOne({
        where: { employee_id: employeeId },
        include: { model: DigitalAsset, as: 'assets' }
      });
      return res
        .status(200)
        .json(response(true, 'Data Konfirmasi Informasi Berhasil Dimuat', employeeVerif));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  requestTemplate: async (req, res) => {
    const { company_id } = req.params;
    const { id, companyParentId } = res.local.users;
    try {
      const companyData = await Company.findOne({ where: { id: company_id } });
      if (!companyData) {
        return res.status(400).json(response(false, 'Tim tidak ditemukan'));
      }
      const companyBranches = await Company.findAll({
        where: { parent_company_id: companyParentId }
      });

      const userData = await User.findOne({ where: { id } });
      const salaryGroups = await SalaryGroups.findAll({
        where: { company_id },
        attributes: ['id', 'salary_name']
      });
      if (!salaryGroups.length) {
        return res
          .status(400)
          .json(response(false, 'Tidak bisa export tabel anggota karena tidak ada golongan gaji'));
      }
      let workbook = new Excel.Workbook();
      workbook.creator = 'Atenda';
      workbook.created = new Date();
      workbook.modified = new Date();
      let worksheet = workbook.addWorksheet('member');

      for (let i = 2; i <= 8; i++) worksheet.getColumn(i).width = 20;

      worksheet.addRow([
        'NO',
        'NAMA',
        'NO_HP',
        'EMAIL',
        'ID_GOL_GAJI',
        'ID_TIM',
        'ROLE',
        'TGL_MASUK_KERJA'
      ]);
      worksheet.getCell('J3').value = 'Catatan';
      worksheet.getCell('J4').value = 'Role';
      worksheet.getCell('J5').value = 1;
      worksheet.getCell('J6').value = 2;
      worksheet.getCell('J7').value = 3;
      worksheet.getCell('J8').value = 4;
      worksheet.getCell('K5').value = 'Manajer';
      worksheet.getCell('K6').value = 'Anggota';
      worksheet.getCell('K7').value = 'Supervisor';
      worksheet.getCell('K8').value = 'Operator';
      worksheet.getCell('J3:J4').font = { bold: true };
      worksheet.getCell('J10').value = 'Golongan Gaji';
      worksheet.getCell('J11').value = 'ID';
      worksheet.getCell('K11').value = 'Nama Golongan';
      worksheet.getCell('J10').font = { bold: true };
      salaryGroups.forEach(data => {
        worksheet.addRow(['', '', '', '', '', '', '', '', '', data.id, data.salary_name]);
      });
      let lastRow = worksheet.lastRow._number + 2;
      worksheet.getCell(`J${lastRow}`).value = 'Lokasi Tim';
      worksheet.getCell(`J${lastRow}`).font = { bold: true };
      worksheet.addRow(['', '', '', '', '', '', '', '', '', 'ID', 'Nama Tim']);
      companyBranches.forEach(data => {
        worksheet.addRow([
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          data.id,
          data.company_name || data.name
        ]);
      });
      await workbook.xlsx.writeFile(`Template Member-${companyData.company_name}.xlsx`);
      /* eslint-disable indent */
      nodemailerMail.sendMail(
        {
          from: 'cs@atenda.id',
          to: userData.email, // An array if you have multiple recipients.
          subject: `Template Member ${companyData.company_name} - Atenda`,
          //You can use "html:" to send HTML email content. It's magic!
          html: mailTemplates.templateMember({ companyData }),
          attachments: [
            {
              filename: `Template Member-${companyData.company_name}.xlsx`,
              path: `Template Member-${companyData.company_name}.xlsx`
            }
          ]
        },
        function(err, info) {
          fs.unlinkSync(`Template Member-${companyData.company_name}.xlsx`);
          if (err) {
            let errorLog = new Date().toISOString() + ' [Manager Inviting]: ' + err + '\n';
            global.emailErrorLog.write(errorLog);
            return res
              .status(400)
              .json(response(false, 'Terjadi kesalahan saat mengirim template excel', err));
          } else {
            return res
              .status(200)
              .json(response(true, 'Template excel telah dikirim ke email anda'));
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
  importMember: async (req, res) => {
    const { company_id } = req.params;
    const { filename, destination } = req.file;
    const { companyParentId } = res.local.users;
    try {
      const companyData = await Company.findOne({ where: { id: company_id } });
      if (!companyData) {
        fs.unlinkSync(destination + '/' + filename);
        return res.status(400).json(response(false, 'Tim tidak ditemukan'));
      }
      const readExcel = ReadExcel.parse(destination + '/' + filename);
      if (!readExcel.length || readExcel[0].name !== 'member') {
        fs.unlinkSync(destination + '/' + filename);
        return res.status(400).json(response(false, 'Format excel salah'));
      }
      const payload = [];
      readExcel[0].data.forEach((data, idx) => {
        if (data.length) {
          if (data[1] && data[2] && data[3] && data[4] && data[5] && data[6] && data[7]) {
            if (idx) {
              let date = new Date(1900, 0, data[7]);
              date = new Date(`${date} +0700`);
              const compose = {
                full_name: data[1],
                phone: `0${data[2]}`,
                email: data[3],
                salary_id: data[4],
                company_id: data[5],
                role: data[6],
                date_start_work: date
              };
              payload.push(compose);
            }
          }
        }
      });
      if (!payload.length) {
        fs.unlinkSync(destination + '/' + filename);
        return res.status(400).json(response(false, 'Tidak ada member untuk diundang'));
      }
      // Data Validation
      const phone = [];
      const email = [];
      let salaryIds = [];
      let companyIds = [];

      const uniqueEmail = payload.filter(
        (elem, index, self) => index === self.findIndex(item => item.email === elem.email)
      );
      if (uniqueEmail.length < payload.length) {
        fs.unlinkSync(destination + '/' + filename);
        return res.status(400).json(response(false, 'Ada email yang terduplikat'));
      }
      const uniquePhone = payload.filter(
        (elem, index, self) => index === self.findIndex(item => item.phone === elem.phone)
      );
      if (uniquePhone.length < payload.length) {
        fs.unlinkSync(destination + '/' + filename);
        return res.status(400).json(response(false, 'Ada nomor telepon yang terduplikat'));
      }
      payload.forEach(data => {
        phone.push(data.phone);
        email.push(data.email);
      });
      const isPhoneExist = await User.findAll({ where: { phone } });
      if (isPhoneExist.length) {
        fs.unlinkSync(destination + '/' + filename);
        return res.status(400).json(response(false, 'Nomor telepon sudah digunakan'));
      }
      const isEmailExist = await User.findAll({ where: { email } });
      if (isEmailExist.length) {
        fs.unlinkSync(destination + '/' + filename);
        return res.status(400).json(response(false, 'Ada email yang sudah digunakan'));
      }
      const uniqueSalaryId = payload.filter(
        (elem, index, self) => index === self.findIndex(item => item.salary_id === elem.salary_id)
      );
      uniqueSalaryId.forEach(data => {
        salaryIds.push(data.salary_id);
      });

      const isOwnSalaryId = await SalaryGroups.findAll({
        where: { id: salaryIds, company_id }
      });
      if (isOwnSalaryId.length !== salaryIds.length) {
        fs.unlinkSync(destination + '/' + filename);
        return res.status(400).json(response(false, 'Ada golongan gaji yang salah'));
      }

      const uniqueCompanyId = payload.filter(
        (elem, index, self) => index === self.findIndex(item => item.company_id === elem.company_id)
      );
      uniqueCompanyId.forEach(data => {
        companyIds.push(data.company_id);
      });
      const isOwnCompanyId = await Company.findAll({
        where: { id: companyIds, parent_company_id: companyParentId }
      });
      if (isOwnCompanyId.length !== companyIds.length) {
        fs.unlinkSync(destination + '/' + filename);
        return res.status(400).json(response(false, 'Ada id tim yang salah'));
      }

      const uniqueRole = payload.filter(
        (elem, index, self) => index === self.findIndex(item => item.role === elem.role)
      );
      for (let i = 0; i < uniqueRole.length; i++) {
        if (uniqueRole[i].role > 4 || uniqueRole[i].role < 1) {
          fs.unlinkSync(destination + '/' + filename);
          return res.status(400).json(response(false, 'Ada role yang salah'));
        }
      }
      for (let i = 0; i < payload.length; i++) {
        let compose = {
          full_name: payload[i].full_name,
          email: payload[i].email.toLowerCase(),
          phone: payload[i].phone,
          hash: crypt.hashSync(new Date().toString() + payload[i].email, 10),
          is_active_notif: 1,
          is_phone_confirmed: 0,
          currency: 'IDR',
          registration_complete: 0
        };
        const createUser = await User.create(compose);
        compose = {
          company_id: payload[i].company_id,
          user_id: createUser.id,
          role: payload[i].role,
          flag: 1,
          active: 1,
          salary_type: 0,
          date_start_work: payload[i].date_start_work
        };
        const createEmployee = await Employee.create(compose);
        compose = {
          employee_id: createEmployee.id,
          salary_id: payload[i].salary_id
        };
        await SalaryDetails.create(compose);
        const data = {
          name: payload[i].full_name,
          email: payload[i].email,
          phone: payload[i].phone
        };
        /* eslint-disable indent */
        nodemailerMail.sendMail(
          {
            from: 'cs@atenda.id',
            to: payload[i].email, // An array if you have multiple recipients.
            subject: `Undangan Anggota ${companyData.company_name} - Atenda`,
            //You can use "html:" to send HTML email content. It's magic!
            html: mailTemplates.managerInviting({ companyData, data })
          },
          function(err, info) {
            if (err) {
              let errorLog = new Date().toISOString() + ' [Manager Inviting]: ' + err + '\n';
              global.emailErrorLog.write(errorLog);
              fs.unlinkSync(destination + '/' + filename);
              return res
                .status(400)
                .json(response(false, 'Failed to send email, please invite member again', err));
            }
          }
        );
      }
      fs.unlinkSync(destination + '/' + filename);
      return res
        .status(200)
        .json(response(true, `Sebanyak ${payload.length} member baru telah berhasil diundang`));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = memberService;

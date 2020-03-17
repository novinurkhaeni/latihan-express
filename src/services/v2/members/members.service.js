require('module-alias/register');
const crypt = require('bcrypt');
const ReadExcel = require('node-xlsx');
const Excel = require('exceljs');
const Sequelize = require('sequelize');
const PdfPrinter = require('pdfmake');
const { Op } = Sequelize;
const {
  response,
  nodemailerMail,
  mailTemplates,
  dateProcessor,
  definedSchedules: definedSchedulesHelper,
  presences: presencesHelper,
  scheduleTemplates: scheduleTemplatesHelper,
  countTotalSchedule,
  dateHelper,
  formatCurrency
} = require('@helpers');
const config = require('config');

const {
  employees: Employee,
  users: User,
  salary_details: SalaryDetails,
  companies: Company,
  presences: Presence,
  journals: Journal,
  journal_details: JournalDetail,
  digital_assets: DigitalAsset,
  employee_notes: EmployeeNote,
  company_settings: CompanySetting,
  salary_groups: SalaryGroups,
  division_details: DivisionDetails,
  divisions: Divisions,
  periodic_pieces: PeriodicPieces
  // cron_members_salary_groups: CronMembersSalaryGroup
} = require('@models');
const fs = require('fs');
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const memberService = {
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
        if (!employee) {
          employee = await Employee.create(employeePayload);
          const salaryDetailsPayload = {
            employee_id: employee.id,
            salary_id: data.salaryId
          };
          await SalaryDetails.create(salaryDetailsPayload);
        } else {
          if (employee.flag.toString() === '3') {
            return res
              .status(400)
              .json(response(false, 'Email terdaftar sudah masuk ke perusahaan'));
          }
          await Employee.update(employeePayload, { where: { user_id: emailExist.id } });
          await SalaryDetails.update(
            { salary_id: data.salaryId },
            { where: { employee_id: employee.id } }
          );
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
        const salaryDetailsPayload = {
          employee_id: employee.id,
          salary_id: data.salaryId
        };
        await SalaryDetails.create(salaryDetailsPayload);
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
  respondMember: async (req, res) => {
    const { employee_id } = req.params;
    const { data } = req.body;
    try {
      const employee = await Employee.findOne({
        where: { id: employee_id },
        include: [
          { model: User, attributes: ['id'] },
          { model: Company, attributes: ['id'] }
        ]
      });
      if (!employee) {
        return res.status(400).json(response(false, 'Member tidak ditemukan'));
      }
      if (data.salaryId) {
        const salaryDetailsPayload = {
          employee_id,
          salary_id: data.salaryId
        };
        await SalaryDetails.create(salaryDetailsPayload);
      }
      const employeePayload = {
        salary_type: data.salaryType,
        role: data.role,
        flag: 3,
        date_start_work: data.dateStartWork,
        active: 1
      };
      await Employee.update(employeePayload, { where: { id: employee_id } });

      observe.emit(EVENT.MEMBER_APPROVED, {
        companyId: employee.company.id,
        employeeId: employee_id
      });

      observe.emit(EVENT.NEW_EMPLOYEE_JOINED, {
        userId: employee.user.id,
        employeeId: employee.id,
        companyId: employee.company.id
      });

      return res.status(200).json(response(true, 'Member berhasil bergabung'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getDetail: async (req, res) => {
    const { employee_id } = req.params;
    const { dateStart, dateEnd } = req.query;
    try {
      const employee = await Employee.findOne({
        where: { id: employee_id },
        include: [
          {
            model: User,
            attributes: ['full_name', 'email', 'phone']
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
          }
        ]
      });

      // Generate All Date in a month based on payroll date
      let arrayDate = [];
      const rangedDate = dateProcessor.getRangedDate(employee.company.setting.payroll_date);
      const totalSchedule = await countTotalSchedule(
        employee.id,
        rangedDate.dateStart,
        rangedDate.dateEnd
      );

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
      for (let i = 1; i <= arrayDate.length; i++) {
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
            }
          }
        ],
        order: [['presence_date', 'ASC']],
        attributes: {
          exclude: ['employee_id', 'checkin_location', 'checkout_location', 'updated_at']
        }
      });
      // Get Presence Data for a Year
      let yearlyPresenceData = await Presence.findAll({
        where: [
          {
            employee_id: employeeId
          },
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y'),
            new Date(dateStart).getFullYear()
          )
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
            }
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
          { employee_id: employeeId, type: ['notes', 'other', 'fine'] },
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
        ],
        attributes: ['id', 'date', 'notes']
      });

      let monthlyPresence = [];
      let workhour = 0;
      let workday = 0;
      let debit = 0;
      let credit = 0;
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
        workhour += presenceData[i].work_hours;
        !presenceData[i].is_absence && workday++;
        presenceData[i].dataValues['journals'] = specificJournalData;
        monthlyPresence.push(presenceData[i]);
      }

      let yearlyPresence = [];
      let yearlyWorkday = 0;

      for (let i = 0; i < yearlyPresenceData.length; i++) {
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
              `${yearlyPresenceData[i].presence_date}`
            )
          ],
          attributes: ['type', 'debet', 'kredit', 'description', 'created_at']
        });
        !yearlyPresenceData[i].is_absence && yearlyWorkday++;
        yearlyPresenceData[i].dataValues['journals'] = specificJournalData;
        yearlyPresence.push(yearlyPresenceData[i]);
      }

      journalData.map(del => {
        debit += del.debet;
        credit += del.kredit;
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

      const mtd_gross_salary = daily_salary * workday;
      let nett_salary = debit - credit;
      let withdraws = 0;
      let grossWithdraws = 0;

      if (withdrawData.length > 0) {
        for (let i = 0; i < withdrawData.length; i++) {
          if (withdrawData[i].status.toString() === '1') {
            withdraws += withdrawData[i].total;
            grossWithdraws += withdrawData[i].total;
          }
        }
      }

      nett_salary = nett_salary - grossWithdraws;

      const salary_summary = {
        bonus: nonSalaryJournal.dataValues.bonus,
        penalty: nonSalaryJournal.dataValues.penalty,
        nett_salary: nett_salary,
        mtd_gross_salary: mtd_gross_salary,
        monthly_gross_salary: salary,
        workhour: workhour
      };

      const memberData = {
        id: employeeId,
        full_name,
        email,
        phone,
        flag,
        role,
        date_start_work: employee.date_start_work,
        salary: employee.salary_groups.length ? employee.salary_groups[0].salary_name : salary,
        salary_id: employee.salary_groups.length ? employee.salary_groups[0].id : null,
        workdays: totalSchedule ? totalSchedule : workdays,
        schedule_ranged: scheduleRanged,
        division: employee.division_details,
        daily_salary,
        withdraws,
        employee_notes: employeeNotes,
        salary_summary: salary_summary,
        presences: monthlyPresence,
        yearly_presences: yearlyPresence,
        assets,
        not_check_log: notCheckLog,
        meal_allowance,
        salary_groups: employee.salary_groups.length ? employee.salary_groups[0] : null,
        salary_type: employee.salary_type
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
  editMember: async (req, res) => {
    const { data } = req.body;
    const { employee_id: employeeId } = req.params;
    const { id, employeeId: currentEmployeeId } = res.local.users;
    try {
      const employee = await Employee.findOne({
        where: { id: employeeId },
        include: [
          { model: User, attributes: ['id', 'full_name'] },
          { model: SalaryGroups, required: false }
        ]
      });
      const userData = await User.findOne({ where: { id } });
      //count role manager
      var countRole = await Employee.findAll({
        where: { role: { [Op.like]: 1 }, company_id: employee.company_id }
      });
      if (!employee) {
        return res.status(400).json(response(false, 'Member tidak ditemukan'));
      }
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
        await SalaryDetails.update(
          { salary_id: data.salaryGroupId },
          { where: { employee_id: employeeId } }
        );
        // const addCronMembersSalaryGroup = await CronMembersSalaryGroup.create({
        //   employee_id: employeeId,
        //   salary_id: data.salaryGroupId
        // });

        // if (!addCronMembersSalaryGroup) {
        //   return res.status(400).json(response(false, 'Data member gagal diubah'));
        // // }
        // return res
        //   .status(200)
        //   .json(response(true, 'Data member akan berubah setelah tanggal tutup buku'));
      } else {
        await SalaryDetails.create({ employee_id: employeeId, salary_id: data.salaryGroupId });
      }
      // SEND NOTIFICATION TO MANAGERS
      const description = `${userData.full_name} telah mengedit data seorang anggota bernama ${employee.user.full_name}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId: currentEmployeeId,
        description
      });
      return res.status(200).json(response(true, 'Data member berhasil diubah'));
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
          if (data[1] && data[2] && data[3] && data[4] && data[5] && data[6]) {
            if (idx) {
              let date = new Date(1900, 0, data[6]);
              date = new Date(`${date} +0700`);
              const compose = {
                full_name: data[1],
                phone: `0${data[2]}`,
                email: data[3],
                salary_id: data[4],
                role: data[5],
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
      let salaryId = [];

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
        salaryId.push(data.salary_id);
      });

      const isOwnSalaryId = await SalaryGroups.findAll({
        where: { id: salaryId, company_id }
      });
      if (isOwnSalaryId.length !== salaryId.length) {
        fs.unlinkSync(destination + '/' + filename);
        return res.status(400).json(response(false, 'Ada golongan gaji yang salah'));
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
          company_id,
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
  },
  requestTemplate: async (req, res) => {
    const { company_id } = req.params;
    const { id } = res.local.users;
    try {
      const companyData = await Company.findOne({ where: { id: company_id } });
      if (!companyData) {
        return res.status(400).json(response(false, 'Tim tidak ditemukan'));
      }
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
      worksheet.addRow(['NO', 'NAMA', 'NO_HP', 'EMAIL', 'ID_GOL_GAJI', 'ROLE', 'TGL_MASUK_KERJA']);
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
              .json(response(false, 'Failed to send email, please invite member again', err));
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
  salarySlip: async (req, res) => {
    const { employee_id } = req.params;
    const { start, end } = req.query;
    try {
      const employee = await Employee.findOne({
        where: { id: employee_id },
        include: [
          { model: User, attributes: ['full_name'] },
          { model: Company, attributes: ['company_name'] },
          { model: SalaryGroups, through: { attributes: ['id'] } }
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
      let debit = 0;
      let credit = 0;
      let grossSalary = 0;
      let netSalary = 0;
      let totalReduction = 0;
      let totalIncome = 0;
      let rangedGrossWithdraws = 0;
      let lunchAllowanceMultiplier = 0;
      let transportAllowanceMultiplier = 0;
      let lunchAllowance = 0;
      let transportAllowance = 0;
      const startDate = new Date(start);
      const endDate = new Date(end);
      const rangedDate = `${startDate.getDate()} ${
        dateHelper[startDate.getMonth() + 1]
      } ${startDate.getFullYear()} - ${endDate.getDate()} ${
        dateHelper[endDate.getMonth() + 1]
      } ${endDate.getFullYear()}`;

      const totalSchedule = await countTotalSchedule(employee_id, start, end);

      const presences = await Presence.findAll({
        where: { employee_id, presence_date: { $between: [start, end] } }
      });
      presences.forEach(data => {
        if (data.is_absence) absence++;
        if (data.is_leave) leave++;
        if (data.is_holiday) holiday++;
      });

      const rangedJournalData = await Journal.findAll({
        where: [
          {
            $not: {
              type: 'withdraw'
            }
          },
          { employee_id },
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
        attributes: [
          'type',
          'debet',
          'kredit',
          'description',
          'created_at',
          'include_lunch_allowance',
          'include_transport_allowance'
        ]
      });

      // Get user withdraw info except role manager
      const rangedWithdrawData = await JournalDetail.findAll({
        include: {
          model: Journal,
          attributes: ['type', 'employee_id', 'description'],
          where: [
            { employee_id, type: 'withdraw' },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('journal_details.created_at'), '%Y-%m-%d'),
              '>=',
              start
            ),
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('journal_details.created_at'), '%Y-%m-%d'),
              '<=',
              end
            )
          ]
        }
      });

      rangedWithdrawData.forEach(data => {
        if (data.status.toString() !== '-1') {
          rangedGrossWithdraws += data.total;
        }
      });

      rangedJournalData.forEach(data => {
        if (data.type === 'salary') grossSalary += data.debet;
        if (data.type === 'other' && data.debet) debit += data.debet;
        if (data.include_lunch_allowance) lunchAllowanceMultiplier++;
        if (data.include_transport_allowance) transportAllowanceMultiplier++;
        credit += data.kredit;
      });
      lunchAllowance = employee.salary_groups[0].lunch_allowance * lunchAllowanceMultiplier;
      transportAllowance =
        employee.salary_groups[0].transport_allowance * transportAllowanceMultiplier;
      grossSalary = grossSalary - (rangedGrossWithdraws + lunchAllowance + transportAllowance);
      totalIncome =
        grossSalary +
        debit +
        transportAllowance +
        lunchAllowance +
        employee.salary_groups[0].bpjs_allowance +
        employee.salary_groups[0].jkk_allowance +
        employee.salary_groups[0].jkm_allowance +
        employee.salary_groups[0].jht_allowance;
      totalReduction =
        credit +
        employee.salary_groups[0].jkk_reduction +
        employee.salary_groups[0].jkm_reduction +
        employee.salary_groups[0].jht_reduction +
        employee.salary_groups[0].tax_reduction;
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
              { text: `${totalSchedule} Hari`, style: 'content' },
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
              { text: 'Gaji Bersih', style: 'content' },
              { text: 'IDR', style: 'content' },
              { text: `Rp. ${formatCurrency(grossSalary)}`, style: 'content' }
            ]
          },
          {
            columns: [
              { text: 'Bonus', style: 'content' },
              { text: 'IDR', style: 'content' },
              { text: `Rp. ${debit}`, style: 'content' }
            ]
          },
          {
            columns: [
              { text: 'Tunjangan Makan', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(lunchAllowance || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'Tunjangan Transport', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(transportAllowance || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'BPJS', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employee.salary_groups[0].bpjs_allowance || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'JKK', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employee.salary_groups[0].jkk_allowance || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'JKM', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employee.salary_groups[0].jkm_allowance || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'JHT', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employee.salary_groups[0].jht_allowance || 0)}`,
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
              { text: `Rp. ${formatCurrency(credit)}`, style: 'content' }
            ]
          },
          {
            columns: [
              { text: 'JKK', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employee.salary_groups[0].jkk_reduction || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'JKM', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employee.salary_groups[0].jkm_reduction || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'JHT', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employee.salary_groups[0].jht_reduction || 0)}`,
                style: 'content'
              }
            ]
          },
          {
            columns: [
              { text: 'PPh21', style: 'content' },
              { text: 'IDR', style: 'content' },
              {
                text: `Rp. ${formatCurrency(employee.salary_groups[0].tax_reduction || 0)}`,
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
  createPeriodic: async (req, res) => {
    const { data } = req.body;
    try {
      const employee = await Employee.findOne({
        where: { id: data.employee_id },
        include: { model: User, attributes: ['full_name'] }
      });
      if (!employee) {
        return res.status(400).json(response(false, 'Member tidak ditemukan'));
      }
      let today = new Date();
      today = new Date(`${today} -0700`);
      today = `${today.getFullYear()}-${('0' + (today.getMonth() + 1)).slice(-2)}-${(
        '0' + today.getDate()
      ).slice(-2)}`;
      const check = await PeriodicPieces.findAll({
        where: { start: data.start, end: { $gte: today }, employee_id: data.employee_id }
      });
      if (check.length) {
        return res
          .status(400)
          .json(response(false, 'Ada potongan berkala yang masih aktif di tanggal yang sama'));
      }
      let startDate = new Date(data.start);
      let endDate = new Date(data.end);
      const day = startDate.getDay();
      const date = startDate.getDate();
      let amount = 0;
      while (startDate <= endDate) {
        if (data.repeat_type === 'weekly' && startDate.getDay() === day) amount += 1;
        if (data.repeat_type === 'monthly' && startDate.getDate() === date) amount += 1;
        startDate.setDate(startDate.getDate() + 1);
      }
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const composeMessage = `${employee.user.full_name} akan diberikan ${
        data.type === 1 ? 'bonus' : 'potongan'
      } sebesar Rp. ${formatCurrency(data.amount)} setiap ${
        data.repeat_type === 'weekly'
          ? `minggu pada hari ${days[new Date(data.start).getDay()]}`
          : `bulan pada tanggal ${new Date(data.start).getDate()}`
      } mulai dari tanggal ${data.start} dan akan berakhir pada tanggal ${data.end}. ${
        data.type === 1 ? 'Bonus' : 'Potongan'
      } ini akan berlangsung sebanyak ${amount} kali dalam periode tersebut`;
      const periodic = await PeriodicPieces.create(data);
      if (!periodic) {
        return res.status(400).json(response(false, 'Potongan berkala gagal dibuat'));
      }
      const journalPayload = {
        employee_id: data.employee_id,
        type: 'periodic',
        debet: data.type === 1 ? data.amount : 0,
        kredit: data.type === 2 ? data.amount : 0,
        description: 'Bonus / potongan otomatis'
      };
      await Journal.create(journalPayload);
      const notePayload = {
        employee_id: data.employee_id,
        type: data.type,
        date: today,
        notes:
          data.note ||
          `${data.type === 1 ? 'Bonus' : 'Potongan'} otomatis sebesar Rp. ${formatCurrency(
            data.amount
          )}`
      };
      await EmployeeNote.create(notePayload);
      return res.status(200).json(response(true, composeMessage));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getPeriodic: async (req, res) => {
    const { employee_id } = req.params;
    try {
      const employee = await Employee.findOne({ where: { id: employee_id } });
      if (!employee) {
        return res.status(400).json(response(false, 'Member tidak ditemukan'));
      }
      const periodic = await PeriodicPieces.findAll({
        where: { employee_id },
        attributes: ['id', 'amount', 'type', 'repeat_type', 'start']
      });
      if (!periodic.length) {
        return res.status(400).json(response(false, 'Tidak ada data'));
      }
      return res.status(200).json(response(true, 'Potongan berkala berhasil dimuat', periodic));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getPeriodicDetail: async (req, res) => {
    const { periodic_id } = req.params;
    try {
      const periodic = await PeriodicPieces.findOne({ where: { id: periodic_id } });
      if (!periodic) {
        return res.status(400).json(response(false, 'Data potongan berkala terpilih tidak ada'));
      }
      return res
        .status(200)
        .json(response(true, 'Detail potongan berkala berhasil dimuat', periodic));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  editPeriodic: async (req, res) => {
    const { periodic_id } = req.params;
    const { data } = req.body;
    try {
      const periodic = await PeriodicPieces.findOne({ where: { id: periodic_id } });
      if (!periodic) {
        return res.status(400).json(response(false, 'Potongan berkala tidak ditemukan'));
      }
      let today = new Date();
      today = new Date(`${today} -0700`);
      today = `${today.getFullYear()}-${('0' + (today.getMonth() + 1)).slice(-2)}-${(
        '0' + today.getDate()
      ).slice(-2)}`;
      const check = await PeriodicPieces.findAll({
        where: { start: data.start, end: { $gte: today }, employee_id: data.employee_id }
      });
      if (check.length) {
        return res
          .status(400)
          .json(response(false, 'Ada potongan berkala yang masih aktif di tanggal yang sama'));
      }
      const editPeriodic = await PeriodicPieces.update(data, { where: { id: periodic_id } });
      if (!editPeriodic) {
        return res.status(400).json(response(false, 'Gagal mengubah potongan berkala'));
      }
      return res.status(200).json(response(true, 'Potongan berkala berhasil diubah'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  deletePeriodic: async (req, res) => {
    const { periodic_id } = req.params;
    try {
      const periodic = await PeriodicPieces.findOne({ where: { id: periodic_id } });
      if (!periodic) {
        return res.status(400).json(response(false, 'Potongan berkala tidak ditemukan'));
      }
      const deletePeriodic = await PeriodicPieces.destroy({ where: { id: periodic_id } });
      if (!deletePeriodic) {
        return res.status(400).json(response(false, 'Gagal menghapus potongan berkala'));
      }
      return res.status(200).json(response(true, 'Potongan berkala berhasil dihapus'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = memberService;

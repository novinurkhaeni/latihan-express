require('module-alias/register');
const crypt = require('bcrypt');
const Sequelize = require('sequelize');
const { response, nodemailerMail, mailTemplates, dateProcessor } = require('@helpers');
const {
  employees: Employee,
  users: User,
  presences: Presence,
  companies: Company,
  journals: Journal,
  journal_details: JournalDetail,
  digital_assets: DigitalAsset,
  employee_notes: EmployeeNote,
  company_settings: CompanySetting
} = require('@models');
const { Op } = Sequelize;

const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const memberService = {
  getDetail: async (req, res) => {
    const { id: memberId } = req.params;
    const { dateStart, dateEnd } = req.query;
    try {
      const employee = await Employee.findOne({
        where: { id: memberId },
        include: [
          {
            model: User,
            attributes: ['full_name', 'email', 'phone']
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
        salary,
        workdays,
        daily_salary,
        withdraws,
        employee_notes: employeeNotes,
        salary_summary: salary_summary,
        presences: monthlyPresence,
        yearly_presences: yearlyPresence,
        assets,
        meal_allowance
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

  get: async (req, res) => {
    const { id: memberId } = req.params;
    const { month, year } = req.query;

    try {
      const employee = await Employee.findOne({
        where: { id: memberId },
        include: [
          {
            model: User,
            attributes: ['full_name', 'email', 'phone']
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

      const { id: employeeId, role, salary, workdays, daily_salary, flag, user, assets } = employee;
      const { full_name, email, phone } = user;

      let presenceData = await Presence.findAll({
        where: [
          {
            employee_id: employeeId
          },
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('presence_date'), '%Y-%m'),
            `${year}-${month}`
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
            $not: {
              type: 'withdraw'
            }
          },
          { employee_id: employeeId },
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m'),
            `${year}-${month}`
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
              Sequelize.fn('DATE_FORMAT', Sequelize.col('journal_details.created_at'), '%Y-%m'),
              `${year}-${month}`
            )
          ]
        }
      });
      const nonSalaryJournal = await Journal.findOne({
        where: [
          { employee_id: employeeId, type: ['notes', 'other', 'fine'] },
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m'),
            `${year}-${month}`
          )
        ],
        attributes: [
          [Sequelize.fn('SUM', Sequelize.col('debet')), 'bonus'],
          [Sequelize.fn('SUM', Sequelize.col('kredit')), 'penalty']
        ]
      });
      const employeeNotes = await EmployeeNote.findAll({
        where: [
          { employee_id: employeeId },
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('date'), '%Y-%m'),
            `${year}-${month}`
          )
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

      journalData.map(del => {
        debit += del.debet;
        credit += del.kredit;
      });

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
        month: month,
        year: year,
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
        salary,
        workdays,
        daily_salary,
        withdraws,
        employee_notes: employeeNotes,
        salary_summary: salary_summary,
        presences: monthlyPresence,
        assets
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

  patch: async (req, res) => {
    const { employee_id } = req.params;
    const { data } = req.body;
    try {
      let employeeData = await Employee.findOne({ where: { id: employee_id } });
      if (!employeeData) {
        return res.status(400).json(response(false, 'Employee data not found'));
      }

      employeeData = await Employee.update(data, {
        where: { id: employee_id }
      });

      if (!employeeData) {
        return res.status(400).json(response(false, 'Failed to update employee status'));
      }

      employeeData = await Employee.findOne({
        where: { id: employee_id },
        include: [
          { model: User, attributes: ['id'] },
          { model: Company, attributes: ['id'] }
        ]
      });

      observe.emit(EVENT.SEND_WELCOME, {
        userId: employeeData.user.id,
        employeeId: employeeData.id
      });

      observe.emit(EVENT.NEW_EMPLOYEE_JOINED, {
        userId: employeeData.user.id,
        employeeId: employeeData.id,
        companyId: employeeData.company.id
      });

      return res.status(200).json(response(true, 'Member berhasil bergabung'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  put: async (req, res) => {
    const { employee_id } = req.params;
    const { data } = req.body;
    const thisDate = new Date();
    let employeeData;
    let userData;
    let withdrawData;

    try {
      employeeData = await Employee.findOne({ where: { id: employee_id } });
      if (!employeeData) {
        return res.status(400).json(response(false, 'Employee data not found'));
      }

      userData = await User.findOne({ where: { id: employeeData.user_id } });
      if (!userData) {
        return res.status(400).json(response(false, 'User data not found'));
      }

      if (data.salary) {
        withdrawData = await Journal.findOne({
          where: [
            { type: 'withdraw', employee_id },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('journals.created_at'), '%Y-%m'),
              `${thisDate.getFullYear()}-${('0' + (thisDate.getMonth() + 1)).slice(-2)}`
            )
          ],
          include: {
            model: JournalDetail,
            where: { status: 0 }
          }
        });

        if (withdrawData) {
          return res
            .status(400)
            .json(
              response(
                false,
                `Tidak dapat mengubah gaji bulanan karena ${userData.full_name} telah melakukan withdraw bulan ini.`
              )
            );
        }
      }

      userData = await User.update(data, {
        where: { id: employeeData.user_id }
      });

      if (!employeeData) {
        return res.status(400).json(response(false, 'Failed to update user data'));
      }

      employeeData = await Employee.update(data, {
        where: { id: employee_id }
      });

      if (!employeeData) {
        return res.status(400).json(response(false, 'Failed to update employee data'));
      }

      employeeData = await Employee.findOne({
        where: { id: employee_id },
        include: [{ model: User, attributes: ['id', 'full_name', 'phone', 'email'] }]
      });

      return res.status(200).json(response(true, 'Informasi member berhasil diubah', employeeData));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  delete: async (req, res) => {
    const { employee_id } = req.params;
    const { id, employeeId } = res.local.users;
    try {
      const userTable = await User.findOne({ where: { id } });
      let employeeData = await Employee.findOne({
        where: { id: employee_id },
        attributes: ['user_id', 'is_dummy', 'company_id'],
        raw: true
      });

      if (!employeeData) {
        return res.status(400).json(response(false, 'Data karyawan tidak ditemukan'));
      }

      const memberName = await User.findOne({
        where: { id: employeeData.user_id },
        attributes: ['full_name'],
        raw: true
      });

      if (employeeData.is_dummy == 1) {
        const deleteMember = await User.destroy({
          where: { id: employeeData.user_id }
        });
        if (!deleteMember) {
          return res.status(400).json(response(false, 'Gagal menghapus anggota'));
        }
      } else {
        const payrollDate = await CompanySetting.findOne({
          where: { company_id: employeeData.company_id },
          attributes: ['payroll_date'],
          raw: true
        });

        const dateStart = dateProcessor.getRangedDate(payrollDate.payroll_date).dateStart;
        const dateEnd = dateProcessor.getRangedDate(payrollDate.payroll_date).dateEnd;

        const presenceData = await Presence.findAll({
          where: {
            employee_id: employee_id,
            presence_date: {
              $between: [dateStart, dateEnd]
            }
          }
        });

        const salaryData = await Journal.findOne({
          where: [
            { employee_id: employee_id, type: 'salary' },
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
          attributes: [[Sequelize.fn('SUM', Sequelize.col('debet')), 'salary_total']],
          raw: true
        });

        const salaryTotal =
          salaryData.salary_total === undefined || salaryData.salary_total === null
            ? 0
            : parseInt(salaryData.salary_total);

        if (presenceData.length <= 0 && salaryTotal <= 0) {
          const deleteEmployee = await Employee.destroy({
            where: { id: employee_id }
          });
          if (!deleteEmployee) {
            return res.status(400).json(response(false, 'Gagal menghapus anggota'));
          }
        } else {
          let payload = {
            active: 0
          };
          const deleteMember = await Employee.update(payload, {
            where: { id: employee_id }
          });

          if (!deleteMember) {
            return res.status(400).json(response(false, 'Gagal menghapus anggota'));
          }
        }
      }
      // SEND NOTIFICATION TO MANAGERS
      const description = `${userTable.full_name} telah menghapus seorang anggota bernama ${memberName.full_name}`;

      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      return res.status(200).json(response(true, 'Angggota berhasil dihapus'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  deleteInvitation: async (req, res) => {
    const { employee_id } = req.params;
    try {
      const employee = await Employee.findOne({ where: { id: employee_id } });
      if (!employee) return res.status(400).json(response(false, 'Anggota tidak ditemukan'));
      // Delete User Will Wipe All Member's Data
      const deleteEmployee = await User.destroy({ where: { id: employee.user_id } });
      if (!deleteEmployee) return res.status(400).json(response(false, 'Gagal menghapus anggota'));
      return res.status(200).json(response(true, 'Undangan anggota berhasil dibatalkan'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  create: async (req, res) => {
    const { data } = req.body;
    const { company_id } = req.params;
    //console.log(data);
    // res.local.users from auth middleware
    // check src/helpers/auth.js

    try {
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
        const payload = Object.assign(
          {},
          data,
          delete data.name,
          delete data.phone,
          delete data.email,
          { user_id: emailExist.id, company_id, active: true }
        );
        let employee = await Employee.findOne({
          where: { user_id: emailExist.id }
        });
        if (!employee) {
          employee = await Employee.create(payload);
        } else {
          if (employee.flag.toString() === '3') {
            return res
              .status(400)
              .json(response(false, 'Email terdaftar sudah masuk ke perusahaan'));
          }
          await Employee.update(payload, { where: { user_id: emailExist.id } });
        }

        const results = Object.assign({}, { id: employee.id }, data);
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
              return res
                .status(201)
                .json(response(true, 'Calon member telah berhasil diundang', results));
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
            role: data.role,
            salary: data.salary,
            workdays: data.workdays,
            daily_salary: data.daily_salary,
            daily_salary_with_meal: data.daily_salary_with_meal,
            meal_allowance: data.meal_allowance,
            flag: data.flag
          }
        );
        const employee = await Employee.create(payloadEmployee);
        const results = Object.assign({}, { id: employee.id }, data);

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
                .json(
                  response(true, 'User telah dibuat dan Member telah berhasil diundang', results)
                );
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

  notes: async (req, res) => {
    const { employee_id } = req.params;
    const { data } = req.body;
    try {
      let employeeNotes;
      let payload;
      if (data.note_id) {
        const noteId = data.note_id;
        payload = Object.assign({}, data, delete data.note_id, { employee_id });
        employeeNotes = await EmployeeNote.update(payload, {
          where: { id: noteId }
        });
        employeeNotes = await EmployeeNote.findOne({ where: { id: noteId } });
      } else {
        employeeNotes = await EmployeeNote.findOne({
          where: { date: data.date, employee_id }
        });
        if (employeeNotes) {
          return res
            .status(400)
            .json(response(false, 'Create note cannot be more than one, please specify note_id'));
        }
        payload = Object.assign({}, data, { employee_id });
        employeeNotes = await EmployeeNote.create(payload);
      }

      if (!employeeNotes) {
        return res.status(400).json(response(false, `Employee note data not created`));
      }
      return res
        .status(201)
        .json(response(true, 'Employee note data has been successfully saved', employeeNotes));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  absence: async (req, res) => {
    const { employee_id: employeeId, presence_id: presenceId } = req.params;
    const { type } = req.body.data;
    const thisDate = new Date();
    const presenceDate = `${thisDate.getFullYear()}-${('0' + (thisDate.getMonth() + 1)).slice(
      -2
    )}-${thisDate.getDate()}`;

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
          id: presenceId
        }
      });
      if (type === 'leave') {
        if (presences) {
          presences = await Presence.update(
            { is_leave: true, work_hours: 8 },
            {
              where: {
                id: presenceId
              }
            }
          );
          presences = await Presence.findOne({ where: { id: presenceId } });
        } else {
          presences = await Presence.create({
            is_leave: true,
            employee_id: employee.id,
            presence_date: presenceDate
          });
        }
        let journal = Journal.findOne({
          where: [
            { employee_id: employee.id, type: 'salary' },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
              Sequelize.fn('DATE_FORMAT', presences.created_at, '%Y-%m-%d')
            )
          ]
        });
        if (!journal) {
          // Should be check if journal already there or not, avoid to create new data journal
          journal = await Journal.create({
            employee_id: employee.id,
            type: 'salary',
            debet: employee.daily_salary,
            description: `Gaji tanggal ${presenceDate}`
          });
        }
        return res.status(200).json(response(true, 'Employee is successfully set leaving today'));
      } else if (type === 'absence') {
        if (presences) {
          presences = await Presence.update(
            { is_absence: true },
            {
              where: {
                id: presenceId
              }
            }
          );
          presences = await Presence.findOne({ where: { id: presenceId } });
        } else {
          presences = await Presence.create({
            is_absence: true,
            employee_id: employee.id,
            presence_date: presenceDate
          });
        }
        // Check if journal already there or not, delete data journal if exist
        let journal = await Journal.findOne({
          where: [
            { employee_id: employee.id, type: 'salary' },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
              Sequelize.fn('DATE_FORMAT', presences.created_at, '%Y-%m-%d')
            )
          ]
        });
        if (journal) {
          journal = await Journal.destroy({
            where: { id: journal.id, employee_id: employee.id, type: 'salary' }
          });
        }
        return res.status(200).json(response(true, 'Employee is successfully set absence today'));
      } else {
        return res.status(422).json(response(false, 'Wrong type request'));
      }
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = memberService;

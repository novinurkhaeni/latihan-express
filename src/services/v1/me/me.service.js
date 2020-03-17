require('module-alias/register');
const { response, compareCoordinates, presenceOverdueCheck, dateProcessor } = require('@helpers');
const {
  users: User,
  notifications: Notification,
  employees: Employee,
  companies: Company,
  company_settings: CompanySetting,
  digital_assets: DigitalAsset,
  presences: Presence,
  journals: Journals,
  journal_details: JournalDetails,
  employee_notes: EmployeeNote,
  promos: Promo,
  notification_creators: NotificationCreator
} = require('@models');

const crypt = require('bcrypt');
const path = require('path');
const config = require('config');
const fs = require('fs');
const Sequelize = require('sequelize');
const { Op } = Sequelize;

const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const meService = {
  patch: async (req, res) => {
    const { id: userId } = res.local.users;
    const { data } = req.body;
    try {
      const userData = await User.findOne({ where: { id: userId } });
      if (!userData) {
        return res.status(400).json(response(false, `User data with id ${userId} is not found`));
      }

      // Update User Data
      const users = Object.assign({}, data);
      if (users.old_password) {
        if (crypt.compareSync(users.old_password, userData.password)) {
          const encryptPassword = crypt.hashSync(users.new_password, 15);
          const usersWithPassword = Object.assign(
            {},
            users,
            { password: encryptPassword },
            delete users.old_password,
            delete users.new_password
          );
          await User.update(usersWithPassword, { where: { id: userId } });
        } else {
          return res.status(400).json(response(false, 'Kata sandi lama tidak sesuai'));
        }
      } else {
        await User.update(users, { where: { id: userId } });
      }
      User.findOne({ where: { id: userId } }).then(result => {
        return res
          .status(200)
          .json(response(true, 'Profile has been successfully updated', result));
      });
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  getDeposit: async (req, res) => {
    const { id: userId } = res.local.users;
    const { dateStart, dateEnd } = req.query;
    try {
      const getEmployeeId = await Employee.findOne({
        where: { user_id: userId },
        attributes: ['id', 'salary', 'workdays', 'daily_salary', 'flag'],
        include: [
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
      const { id: employeeId, salary, daily_salary, flag, assets } = getEmployeeId;

      const userData = await User.findOne({
        where: { id: userId },
        attributes: ['full_name', 'email', 'phone']
      });
      const { full_name, email, phone } = userData;

      let presenceData = await Presence.findAll({
        where: [
          {
            employee_id: employeeId
          },
          {
            presence_date: {
              [Op.gte]: dateStart,
              [Op.lte]: dateEnd
            }
          }
        ],
        order: [['presence_date', 'ASC']],
        attributes: {
          exclude: [
            'employee_id',
            'checkin_location',
            'checkout_location',
            'created_at',
            'updated_at'
          ]
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

      const today = new Date();
      today.setHours(today.getHours() + 7);
      const todayPresence = await Presence.findOne({
        attributes: ['presence_date', 'presence_start', 'presence_end', 'rest_start', 'rest_end'],
        where: [
          {
            employee_id: employeeId
          },
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('presence_date'), '%Y-%c-%e'),
            `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
          )
        ]
      });

      const rangedJournalData = await Journals.findAll({
        where: [
          {
            $not: {
              type: 'withdraw'
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

      const journalData = await Journals.findAll({
        where: [
          {
            $not: {
              type: 'withdraw'
            }
          },
          { employee_id: employeeId },
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%c'),
            `${today.getFullYear()}-${today.getMonth() + 1}`
          )
        ],
        attributes: ['type', 'debet', 'kredit', 'description', 'created_at']
      });

      const rangedWithdrawData = await JournalDetails.findAll({
        include: {
          model: Journals,
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

      const withdrawData = await JournalDetails.findAll({
        include: {
          model: Journals,
          attributes: ['type', 'employee_id', 'description'],
          where: [
            { employee_id: employeeId, type: 'withdraw' },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('journal_details.created_at'), '%Y-%c'),
              `${today.getFullYear()}-${today.getMonth() + 1}`
            )
          ]
        }
      });

      const nonSalaryJournal = await Journals.findOne({
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
        where: {
          employee_id: employeeId,
          date: {
            [Op.gte]: dateStart,
            [Op.lte]: dateEnd
          }
        },

        attributes: ['id', 'date', 'notes']
      });

      let monthlyPresence = [];
      let workhour = 0;
      let workday = 0;
      let rangedDebit = 0;
      let rangedCredit = 0;
      let debit = 0;
      let credit = 0;

      for (let i = 0; i < presenceData.length; i++) {
        let specificJournalData = await Journals.findAll({
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
        let specificJournalData = await Journals.findAll({
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

      rangedJournalData.map(del => {
        rangedDebit += del.debet;
        rangedCredit += del.kredit;
      });

      journalData.map(del => {
        debit += del.debet;
        credit += del.kredit;
      });

      const mtd_gross_salary = daily_salary * workday;
      let ranged_nett_salary = rangedDebit - rangedCredit;
      // todo: DELETE THIS NET_SALARY ONCE ALL APP GET UPDATED !
      /* eslint-disable*/
      let nett_salary = debit - credit;
      /*eslint-enabled*/
      let withdraws = 0;
      let rangedGrossWithdraws = 0;
      let grossWithdraws = 0;

      if (rangedWithdrawData.length > 0) {
        for (let i = 0; i < rangedWithdrawData.length; i++) {
          if (rangedWithdrawData[i].status.toString() === '1') {
            withdraws += rangedWithdrawData[i].total;
          }
          if (rangedWithdrawData[i].status.toString() !== '-1') {
            rangedGrossWithdraws += rangedWithdrawData[i].total;
          }
        }
      }

      if (withdrawData.length > 0) {
        for (let i = 0; i < withdrawData.length; i++) {
          if (withdrawData[i].status.toString() !== '-1') {
            grossWithdraws += withdrawData[i].total;
          }
        }
      }

      ranged_nett_salary = ranged_nett_salary - rangedGrossWithdraws;
      nett_salary = nett_salary - grossWithdraws;

      const result = {
        id: userId,
        full_name: full_name,
        email: email,
        phone: phone,
        flag: flag,
        withdraws,
        employee_notes: employeeNotes,
        salary_summary: {
          bonus: nonSalaryJournal.dataValues.bonus,
          penalty: nonSalaryJournal.dataValues.penalty,
          strict_nett_salary: ranged_nett_salary,
          nett_salary: ranged_nett_salary,
          mtd_gross_salary: mtd_gross_salary,
          monthly_gross_salary: salary,
          workhour: workhour
        },
        today_presence: todayPresence || null,
        presences: monthlyPresence,
        yearly_presences: yearlyPresence,
        assets
      };

      return res
        .status(200)
        .json(response(true, 'Deposit summary list been successfully retrieved', result));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  deposit: async (req, res) => {
    const { id: userId } = res.local.users;
    const { month, year } = req.query;

    try {
      const getEmployeeId = await Employee.findOne({
        where: { user_id: userId },
        attributes: ['id', 'salary', 'workdays', 'daily_salary', 'flag'],
        include: [
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
      const { id: employeeId, salary, daily_salary, flag, assets } = getEmployeeId;

      const userData = await User.findOne({
        where: { id: userId },
        attributes: ['full_name', 'email', 'phone']
      });
      const { full_name, email, phone } = userData;

      let presenceData = await Presence.findAll({
        where: [
          {
            employee_id: employeeId
          },
          {
            presence_end: {
              [Op.ne]: null
            }
          },
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('presence_date'), '%Y-%m'),
            `${year}-${month}`
          )
        ],
        order: [['presence_date', 'ASC']],
        attributes: {
          exclude: [
            'employee_id',
            'checkin_location',
            'checkout_location',
            'created_at',
            'updated_at'
          ]
        }
      });

      const today = new Date();
      const todayPresence = await Presence.findOne({
        attributes: ['presence_date', 'presence_start', 'presence_end', 'rest_start', 'rest_end'],
        where: [
          {
            employee_id: employeeId
          },
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('presence_date'), '%Y-%m-%e'),
            `${year}-${month}-${today.getDate()}`
          )
        ]
      });

      const journalData = await Journals.findAll({
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

      const withdrawData = await JournalDetails.findAll({
        include: {
          model: Journals,
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

      const nonSalaryJournal = await Journals.findOne({
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
        let specificJournalData = await Journals.findAll({
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
          }
          if (withdrawData[i].status.toString() !== '-1') {
            grossWithdraws += withdrawData[i].total;
          }
        }
      }

      nett_salary = nett_salary - grossWithdraws;

      const result = {
        id: userId,
        full_name: full_name,
        email: email,
        phone: phone,
        flag: flag,
        withdraws,
        employee_notes: employeeNotes,
        salary_summary: {
          month: month,
          year: year,
          bonus: nonSalaryJournal.dataValues.bonus,
          penalty: nonSalaryJournal.dataValues.penalty,
          nett_salary: nett_salary,
          mtd_gross_salary: mtd_gross_salary,
          monthly_gross_salary: salary,
          workhour: workhour
        },
        today_presence: todayPresence || null,
        presences: monthlyPresence,
        assets
      };

      return res
        .status(200)
        .json(response(true, 'Deposit summary list been successfully retrieved', result));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  get: async (req, res) => {
    const { employeeId } = res.local.users;
    try {
      const notifications = await Notification.findAll({
        where: { employee_id: employeeId },
        order: [['created_at', 'DESC']],
        attributes: ['id', 'body', 'is_read', 'created_at'],
        include: [
          {
            model: Employee,
            attributes: ['id'],
            include: { model: Company, attributes: ['company_name', 'name'] }
          },
          {
            model: NotificationCreator,
            attributes: ['id'],
            include: {
              model: Employee,
              attributes: ['id'],
              include: {
                model: DigitalAsset,
                required: false,
                attributes: ['url', 'type'],
                where: {
                  type: 'avatar'
                },
                as: 'assets'
              }
            }
          }
        ]
      });
      const results = [];
      for (let i = 0; i < notifications.length; i++) {
        results.push({
          id: notifications[i].id,
          message: notifications[i].body,
          is_read: notifications[i].is_read,
          created_at: notifications[i].created_at,
          employee: {
            id: notifications[i].employee.id,
            company: {
              company_name: notifications[i].employee.company.company_name,
              name: notifications[i].employee.company.name
            }
          },
          avatar_creator: notifications[i].notification_creator
            ? notifications[i].notification_creator.employee.assets.length
              ? notifications[i].notification_creator.employee.assets[0].url
              : null
            : null
        });
      }

      if (!notifications) {
        return res.status(400).json(response(false, 'Notifications not found'));
      }
      return res
        .status(200)
        .json(response(true, 'Notifications has been successfully retrieved', results));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  checklog: async (req, res) => {
    const { id: user_id } = res.local.users;
    const presencesLocation = req.body.location.replace(/\s/g, '').split(',');
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
          }
        ]
      });

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

      // Date.prototype.addHours = function(h) {
      //   this.setTime(this.getTime() + h * 60 * 60 * 1000);
      //   return this;
      // };
      const thisDate = new Date();
      let presenceDate = new Date(`${thisDate} -0700`);
      presenceDate = `${presenceDate.getFullYear()}-${('0' + (presenceDate.getMonth() + 1)).slice(
        -2
      )}-${presenceDate.getDate()}`;
      if (req.body.type.toString() === 'checkin') {
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
        const presence_overdue = await presenceOverdueCheck(
          new Date(`${thisDate} -0700`),
          employeeData.id
        );

        let payload = {
          employee_id: employeeData.id,
          presence_date: presenceDate,
          presence_start: thisDate,
          checkin_location: req.body.location
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
        const overWorked = work_hours - restHours - employeeData.company.setting.overwork_limit;
        const overwork = overWorked < 0 ? 0 : overWorked;

        presenceProcess = await Presence.update(
          {
            presence_end: thisDate,
            checkout_location: req.body.location,
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
        await Journals.create({
          employee_id: employeeData.id,
          type: 'salary',
          debet: employeeData.daily_salary_with_meal
            ? employeeData.daily_salary_with_meal
            : employeeData.daily_salary,
          description: `Gaji tanggal ${presenceDate}`
        });

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

  rest: async (req, res, checkLocation = true) => {
    const { type } = req.body;
    const { id: userId } = checkLocation ? res.local.users : req.params;
    const thisDate = new Date();
    let presenceDate = new Date();
    presenceDate.setHours(presenceDate.getHours() + 7);
    presenceDate = `${presenceDate.getFullYear()}-${('0' + (presenceDate.getMonth() + 1)).slice(
      -2
    )}-${presenceDate.getDate()}`;

    const host =
      process.env.NODE_ENV !== 'production'
        ? `http://${config.host}:${config.port}/`
        : `https://${config.host}/`;

    let filepath;
    let payloadDigital = {
      type: type,
      uploadable_type: 'presences'
    };

    try {
      const employee = await Employee.findOne({
        where: { user_id: userId },
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
          employee_id: employee.id,
          presence_date: presenceDate
        }
      });
      if (!presences) {
        return res.status(400).json(response(false, 'Anda belum melakukan check-in hari ini'));
      }

      if (checkLocation) {
        const presencesLocation = req.body.location.replace(/\s/g, '').split(',');
        const companyLocation = employee.company.location.replace(/\s/g, '').split(',');
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

      if (type.toString() === 'rest_start') {
        if (presences.rest_start) {
          return res.status(400).json(response(false, 'Anda sudah istirahat hari ini'));
        }
        // Insert digital assets data
        payloadDigital['uploadable_id'] = presences.id;
        await DigitalAsset.create(payloadDigital);

        presences = Presence.update(
          { rest_start: thisDate },
          {
            where: {
              employee_id: employee.id,
              presence_date: presenceDate
            }
          }
        );
      } else if (type.toString() === 'rest_end') {
        if (presences.rest_end) {
          return res.status(400).json(response(false, 'Anda sudah selesai istirahat hari ini'));
        }
        // Insert digital assets data
        payloadDigital['uploadable_id'] = presences.id;
        await DigitalAsset.create(payloadDigital);

        // For testing rest_end time purpose, uncomment below
        // Date.prototype.addMinutes = function(m) {
        //     this.setMinutes(this.getMinutes() + m * 60000);
        //     return this;
        // };
        const started = new Date(`${presences.rest_start}+0700`);
        const totalRest = Math.floor(Math.abs(thisDate - started) / (1000 * 60)); // minutes
        const restOverdue = Math.floor(totalRest - employee.company.setting.rest_limit);
        const rest_overdue = restOverdue < 0 ? 0 : restOverdue;
        presences = Presence.update(
          { rest_end: thisDate, rest_overdue },
          {
            where: {
              employee_id: employee.id,
              presence_date: presenceDate
            }
          }
        );
      }

      return res
        .status(201)
        .json(
          response(
            true,
            `Berhasil melakukan ${type.toString() === 'rest_start' ? 'istirahat' : 'kembali'}`
          )
        );
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  getWithdraws: async (req, res) => {
    const { employeeId } = req.params;
    try {
      const employee = await Employee.findOne({
        order: [['id', 'desc']],
        where: { id: employeeId }
      });
      if (!employee) {
        return res.status(400).json(response(false, 'Employee data not found'));
      }
      const withdrawHistory = await JournalDetails.findAll({
        order: [['created_at', 'DESC']],
        include: [
          {
            model: Journals,
            where: { type: 'withdraw', employee_id: employee.id },
            attributes: ['id', 'employee_id', 'type']
          }
        ]
      });

      for (let i = 0; i <= withdrawHistory.length; i++) {
        const assets = [];
        let promo = null;
        if (withdrawHistory[i]) {
          const asset = await DigitalAsset.findOne({
            where: {
              type: 'withdraw',
              uploadable_type: 'withdraw',
              uploadable_id: withdrawHistory[i].dataValues.id
            }
          });
          if (withdrawHistory[i].dataValues.promo_id) {
            promo = await Promo.findOne({
              attributes: [
                'id',
                'code',
                'type',
                'amount',
                'effective_date',
                'expired_date',
                'limit',
                'usage'
              ],
              where: { id: withdrawHistory[i].dataValues.promo_id }
            });
          }
          if (asset) {
            assets.push({
              url: asset.dataValues.url,
              type: asset.dataValues.type
            });
          }
          Object.assign(withdrawHistory[i].dataValues, { assets, promo });
        }
      }
      return res
        .status(200)
        .json(response(true, 'Withdraws histories been successfully retrieved', withdrawHistory));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  withdraws: async (req, res) => {
    const { employeeId: employee_id } = res.local.users;
    const { data } = req.body;

    const date = new Date();
    const thisDate = `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(
      -2
    )}-${date.getDate()}`;
    let promo;
    let journalDetailPayload = {};

    try {
      const employee = await Employee.findOne({
        where: { id: employee_id },
        include: {
          model: User
        }
      });
      if (!employee) {
        return res.status(400).json(response(false, 'Employee data not found'));
      }
      const { company_id: companyId, id: employeeId } = employee;
      // Get Company Payroll Date
      const payrollDate = await CompanySetting.findOne({
        where: { company_id: companyId },
        attributes: ['payroll_date']
      });
      const dateObject = dateProcessor.getRangedDate(payrollDate.payroll_date);
      const { dateStart, dateEnd } = dateObject;

      // Count Net Salary for Withdraw Validation
      let debit = 0;
      let credit = 0;
      let rangedGrossWithdraws = 0;
      const rangedJournalData = await Journals.findAll({
        where: [
          {
            $not: {
              type: 'withdraw'
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

      const rangedWithdrawData = await JournalDetails.findAll({
        where: { status: { [Op.ne]: -1 } },
        include: {
          model: Journals,
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

      rangedJournalData.map(val => {
        debit += val.debet;
        credit += val.kredit;
      });

      if (rangedWithdrawData.length > 0) {
        for (let i = 0; i < rangedWithdrawData.length; i++) {
          rangedGrossWithdraws += rangedWithdrawData[i].total;
        }
      }

      let ranged_nett_salary = debit - credit;
      ranged_nett_salary = ranged_nett_salary - rangedGrossWithdraws;
      ranged_nett_salary = ranged_nett_salary * 0.8;

      if (ranged_nett_salary < 400000) {
        return res.status(400).json(response(false, 'Jumlah upah anda tidak mencukupi'));
      }

      // Increment promo usage
      if (data.code) {
        promo = await Promo.findOne({
          where: [
            Sequelize.where(Sequelize.col('usage'), '<', Sequelize.col('limit')),
            { code: data.code, expired_date: { $gte: thisDate } }
          ]
        });
        if (!promo) {
          return res.status(400).json(response(false, 'Promo sudah melebihi batas penggunaan'));
        }
        await Promo.increment('usage', { where: { code: data.code } });

        journalDetailPayload.promo_id = promo.id;
        journalDetailPayload.promo_applied = promo.amount;
      }

      const journal = await Journals.create({
        employee_id: employeeId,
        type: 'withdraw'
      });

      journalDetailPayload = Object.assign({}, journalDetailPayload, {
        journal_id: journal.id,
        tax: data.tax,
        fee: data.fee,
        total: data.total_amount,
        total_nett: data.total_nett,
        last_salary: ranged_nett_salary,
        bank_name: data.bank_name || null,
        account_number: data.account_number || null
      });

      const journalDetails = await JournalDetails.create(journalDetailPayload);

      if (!journal && !journalDetails) {
        return res.status(400).json(response(true, 'Can not create withdraw'));
      }

      //SEND EMAIL CONFIRMATION
      observe.emit(EVENT.WITHDRAW_REQUEST, {
        userId: employee.user.id, //
        companyId: employee.company_id,
        thisDate,
        totalWithdraw: journalDetails.total
      });

      return res
        .status(200)
        .json(response(true, 'Withdraw has been successfully created', journalDetails));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  checklogValidation: async (req, res, checkLocation = true) => {
    const { id: user_id } = checkLocation ? res.local.users : req.params;
    let presenceProcess;
    try {
      const employeeData = await Employee.findOne({
        where: { user_id },
        include: [
          {
            model: Company
          }
        ]
      });
      if (checkLocation) {
        const presencesLocation = req.body.location.replace(/\s/g, '').split(',');
        const companyLocation = await employeeData.company.location.replace(/\s/g, '').split(',');
        const radius = compareCoordinates(
          presencesLocation[0],
          presencesLocation[1],
          companyLocation[0],
          companyLocation[1]
        );

        if (parseFloat(radius) >= 505) {
          return 'Presensi anda tidak di tempat yang sesuai dengan kantor';
        }
      }

      const thisDate = new Date();
      thisDate.setHours(thisDate.getHours() + 7);
      const presenceDate = `${thisDate.getFullYear()}-${('0' + (thisDate.getMonth() + 1)).slice(
        -2
      )}-${thisDate.getDate()}`;

      presenceProcess = await Presence.findOne({
        where: {
          employee_id: employeeData.id,
          presence_date: presenceDate
        }
      });

      if (req.body.type.toString() === 'checkin') {
        if (presenceProcess) {
          return 'Anda sudah melakukan check-in sebelumnya';
        }

        return true;
      } else if (req.body.type.toString() === 'checkout') {
        if (!presenceProcess) {
          return 'Mohon lakukan check-in terlebih dahulu';
        }

        return true;
      } else if (req.body.type.toString() === 'rest_start') {
        if (presenceProcess.rest_start) {
          return 'Anda sudah istirahat hari ini';
        }

        return true;
      } else if (req.body.type.toString() === 'rest_end') {
        if (presenceProcess.rest_end) {
          return 'Anda sudah selesai istirahat hari ini';
        }

        return true;
      }
    } catch (error) {
      if (error.errors) {
        return error.errors;
      }
      return error.message;
    }
  }
};

module.exports = meService;

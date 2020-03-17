/* eslint-disable indent */
require('module-alias/register');
const { Sequelize } = require('sequelize');
const Moment = require('moment-timezone');
const {
  sequelize,
  presences: PresenceModel,
  employees: EmployeesModel,
  users: UserModel,
  journals: Journal,
  journal_details: JournalDetail,
  digital_assets: DigitalAsset,
  companies: CompanyModel,
  allowance: Allowance,
  employee_notes: EmployeeNote,
  submissions: Submission,
  salary_groups: SalaryGroup,
  company_settings: CompanySetting
} = require('@models');
const {
  response,
  getAddress,
  countWorkdays,
  countTotalSchedule,
  dateProcessor
} = require('@helpers');

const presencesService = {
  getCustomPresenceDetail: async (req, res) => {
    const { presenceId } = req.params;
    try {
      const presence = await PresenceModel.findOne({
        where: {
          id: presenceId,
          custom_presence: 1
        },
        include: [
          {
            model: EmployeesModel,
            include: [
              {
                model: UserModel,
                attributes: ['full_name']
              },
              {
                model: DigitalAsset,
                attributes: ['url'],
                required: false,
                where: {
                  type: 'avatar'
                },
                as: 'assets'
              }
            ],
            as: 'employee'
          },
          {
            model: DigitalAsset,
            required: false,
            attributes: ['url', 'type'],
            where: {
              type: ['checkin', 'checkout', 'rest_start', 'rest_end']
            },
            as: 'assets'
          }
        ]
      });
      if (!presence)
        return res
          .status(400)
          .json(response(false, 'Data detail ceklok lokasi lain tidak ditemukan'));

      const presence_assets = presence.assets.reduce((_obj, item) => {
        const obj = _obj;
        obj[item.type] = item.url;
        return obj;
      }, {});

      const coord = {
        checkin_location: presence.checkin_location,
        checkout_location: presence.checkout_location,
        rest_begin_location: presence.rest_begin_location,
        rest_over_location: presence.rest_over_location
      };

      const address = await getAddress(coord);

      const data = {
        id: presence.id,
        full_name: presence.employee.user.full_name,
        presence_date: presence.presence_date,
        address,
        presence_start: presence.presence_start,
        presence_end: presence.presence_end,
        rest_start: presence.rest_start,
        rest_end: presence.rest_end,
        presence_start_photo: presence_assets.checkin,
        presence_end_photo: presence_assets.checkout,
        rest_start_photo: presence_assets.rest_start,
        rest_end_photo: presence_assets.rest_end,
        avatar: presence.employee.assets.length ? presence.employee.assets[0].dataValues.url : null
      };

      return res
        .status(200)
        .json(response(true, 'Data detail ceklok lokasi lain berhasil didapatkan', data));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  createPresenceManual: async (req, res) => {
    const { employeeId } = res.local.users;
    const { data } = req.body;
    const { type } = req.query;
    const start = new Date(data.presence_start); // date start of manual presence
    const end = new Date(data.presence_end); // date end of manual presence
    const transaction = await sequelize.transaction();
    try {
      if (start == 'Invalid Date' || end == 'Invalid Date') {
        return res.status(422).json(response(false, 'Input date must yyyy-mm-dd format'));
      }

      // Find Company ID of Login User
      const currentUser = await EmployeesModel.findOne({
        where: { id: employeeId },
        attributes: ['id'],
        include: {
          model: CompanyModel,
          attributes: ['id'],
          include: { model: CompanySetting, attributes: ['payroll_date'], as: 'setting' }
        }
      });

      // Generate All Date in a month based on payroll date
      const rangedDate = dateProcessor.getRangedDate(currentUser.company.setting.payroll_date);

      // intiate 'array_date' will used in looping to know how many data will be insert to presence table
      let arrayDate = [];
      while (start <= end) {
        arrayDate.push(
          `${start.getFullYear()}-${('0' + (start.getMonth() + 1)).slice(-2)}-${(
            '0' + start.getDate()
          ).slice(-2)}`
        );
        start.setDate(start.getDate() + 1);
      }

      // save data to presences table
      let payload = [];
      let journalPayloads = [];
      for (const date of arrayDate) {
        for (const employeeId of data.member) {
          const presence = await PresenceModel.findOne({
            where: { employee_id: employeeId, presence_date: date }
          });
          if (presence) {
            return res
              .status(422)
              .json(
                response(
                  false,
                  `Presence with member_id ${employeeId} and presence_date ${date} already axist`
                )
              );
          }

          const employee = await EmployeesModel.findOne({
            where: { id: employeeId },
            include: {
              model: SalaryGroup,
              through: { attributes: ['id'] }
            }
          });
          if (employee.salary_groups.length && !data.is_back_date) {
            let workdays;
            // IF MEMBER HAVE DAILY FREQUENT ON THEIR SALARY GROUP <-> V2.1
            if (employee.salary_groups[0].daily_frequent) {
              const dailyFrequent = employee.salary_groups[0].daily_frequent;
              workdays = countWorkdays(dailyFrequent, rangedDate.dateStart, rangedDate.dateEnd);
            } else {
              // IF MEMBER DOESNT HAVE DAILY FREQUENT ON THEIR SALARY GROUP, COUNT WORKDAYS BASED ON SCHEDULE INSTEAD <-> V2.1
              workdays = await countTotalSchedule(
                employee.id,
                rangedDate.dateStart,
                rangedDate.dateEnd
              );
            }
            if (workdays) {
              const createdAt = new Date(`${new Date(date)} +0700`);
              if (type === 'attend') {
                const allowances = await Allowance.findAll({
                  where: { salary_groups_id: employee.salary_groups[0].id, type: 1 },
                  attributes: ['id', 'amount', 'name']
                });
                if (allowances.length) {
                  for (const allowance of allowances) {
                    journalPayloads.push({
                      employee_id: employeeId,
                      type: 'allowance',
                      salary_groups_id: null,
                      allowance_id: allowance.id,
                      debet: allowance.amount,
                      description: `Tunjangan ${allowance.name} tanggal ${date}`,
                      include_lunch_allowance: 0,
                      include_transport_allowance: 0,
                      created_at: createdAt
                    });
                  }
                }
              }
              journalPayloads.push({
                employee_id: employeeId,
                type: 'salary',
                salary_groups_id: employee.salary_groups[0].id,
                debet: parseInt(employee.salary_groups[0].salary) / parseInt(workdays),
                description: `Gaji tanggal ${date}`,
                include_lunch_allowance: type === 'attend' ? 1 : 0,
                include_transport_allowance: type === 'attend' ? 1 : 0,
                created_at: createdAt
              });
            }
          }

          let presencePayload = {
            employee_id: employeeId,
            company_id: employee.company_id,
            presence_date: date
          };
          switch (type) {
            case 'absence':
              presencePayload.is_absence = 1;
              break;
            case 'leave':
              presencePayload.is_leave = 1;
              break;
            case 'holiday':
              presencePayload.is_holiday = 1;
              break;
            case 'permit':
              presencePayload.is_permit = 1;
              break;
            default:
              break;
          }
          payload.push(presencePayload);
        }
      }
      const createPresences = await PresenceModel.bulkCreate(payload, { transaction });
      if (!createPresences) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal membuat presensi manual'));
      }
      if (journalPayloads.length) {
        const createJournals = await Journal.bulkCreate(journalPayloads);
        if (!createJournals) {
          await transaction.rollback();
          return res.status(400).json(response(false, 'Gagal membuat presensi manual'));
        }
      }
      await transaction.commit();
      return res.status(201).json(response(true, 'Presensi manual berhasil dibuat'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getPresenceDetail: async (req, res) => {
    const { presenceId } = req.params;
    try {
      const presence = await PresenceModel.findOne({
        where: {
          id: presenceId
        },
        include: [
          {
            model: Submission,
            required: false,
            attributes: ['start_date', 'end_date'],
            include: {
              model: DigitalAsset,
              required: false,
              attributes: ['url', 'filename'],
              where: {
                type: 'leave'
              },
              as: 'assets'
            }
          },
          {
            model: EmployeesModel,
            include: [
              {
                model: DigitalAsset,
                attributes: ['url'],
                required: false,
                where: {
                  type: 'avatar'
                },
                as: 'assets'
              },
              {
                model: UserModel,
                attributes: ['full_name']
              },
              { model: CompanyModel, attributes: ['timezone'] }
            ],
            as: 'employee'
          },
          {
            model: DigitalAsset,
            required: false,
            attributes: ['url', 'type', 'filename'],
            where: {
              type: ['checkin', 'checkout', 'rest_start', 'rest_end']
            },
            as: 'assets'
          },
          { model: CompanyModel, attributes: ['company_name', 'name'] }
        ]
      });
      if (!presence)
        return res.status(400).json(response(false, 'Data detail presensi tidak ditemukan'));

      const presence_assets = presence.assets.reduce((_obj, item) => {
        const obj = _obj;
        obj[item.type] = item.url;
        return obj;
      }, {});

      const bonusOrPenalty = await getBonusOrPenalty(presence.employee_id, presence.presence_date);
      const salary = await getSalary(presence.employee_id, presence.presence_date);
      const notes = await getEmployeeNotes(presence.employee_id, presence.presence_date);
      let dailySalary = 0,
        gajiPokok = 0;
      const bonusDetail = [],
        penaltyDetail = [],
        allowancesDetail = [];

      for (let i = 0; i < bonusOrPenalty.length; i++) {
        if (bonusOrPenalty[i].debet !== 0) {
          const bonus = {
            id: bonusOrPenalty[i].id,
            debet: bonusOrPenalty[i].debet,
            note: bonusOrPenalty[i].description
          };

          bonusDetail.push(bonus);
        } else if (bonusOrPenalty[i].kredit !== 0) {
          const potongan = {
            id: bonusOrPenalty[i].id,
            kredit: bonusOrPenalty[i].kredit,
            note: bonusOrPenalty[i].description
          };
          penaltyDetail.push(potongan);
        }
      }

      const allowances = await getAllowances(presence.employee_id, presence.presence_date);
      let totalDailyAllowance = 0;
      for (const allowance of allowances) {
        allowancesDetail.push({
          id: allowance.allowance_id,
          type: allowance.allowance ? allowance.allowance.type : null,
          name: allowance.allowance ? allowance.allowance.name : null,
          amount: allowance.debet
        });
        totalDailyAllowance += allowance.debet;
      }

      if (salary) {
        dailySalary = salary.debet ? salary.debet + totalDailyAllowance : 0;
        gajiPokok = salary.debet ? salary.debet : 0;
      }

      const dailySalaryDetail = {
        gaji_pokok: gajiPokok,
        allowances_detail: allowancesDetail
      };

      const coord = {
        checkin_location: presence.checkin_location,
        checkout_location: presence.checkout_location,
        rest_begin_location: presence.rest_begin_location,
        rest_over_location: presence.rest_over_location
      };

      const address = await getAddress(coord);

      let branch;
      if (!presence.company) {
        branch = await EmployeesModel.findOne({
          where: { id: presence.employee_id },
          attributes: ['id'],
          include: { model: CompanyModel, attributes: ['company_name', 'name'] }
        });
      }
      const data = {
        id: presence.id,
        full_name: presence.employee.user.full_name,
        presence_date: presence.presence_date,
        address,
        presence_start: presence.presence_start
          ? Moment(presence.presence_start)
              .tz(presence.employee.company.timezone)
              .add(-process.env.TIMEZONE_OFFSET, 'hour')
              .format('HH:mm')
          : '-',
        presence_end: presence.presence_end
          ? Moment(presence.presence_end)
              .tz(presence.employee.company.timezone)
              .add(-process.env.TIMEZONE_OFFSET, 'hour')
              .format('HH:mm')
          : '-',
        rest_start: presence.rest_start
          ? Moment(presence.rest_start)
              .tz(presence.employee.company.timezone)
              .add(-process.env.TIMEZONE_OFFSET, 'hour')
              .format('HH:mm')
          : '-',
        rest_end: presence.rest_end
          ? Moment(presence.rest_end)
              .tz(presence.employee.company.timezone)
              .add(-process.env.TIMEZONE_OFFSET, 'hour')
              .format('HH:mm')
          : '-',
        presence_start_photo: presence_assets.checkin ? presence_assets.checkin : null,
        presence_end_photo: presence_assets.checkout ? presence_assets.checkout : null,
        rest_start_photo: presence_assets.rest_start ? presence_assets.rest_start : null,
        rest_end_photo: presence_assets.rest_end ? presence_assets.rest_end : null,
        avatar: presence.employee.assets.length ? presence.employee.assets[0].dataValues.url : null,
        daily_salary: dailySalary,
        daily_salary_detail: dailySalaryDetail,
        bonus_detail: bonusDetail,
        penalty_detail: penaltyDetail,
        presence_overdue: presence.presence_overdue,
        overwork: presence.overwork,
        home_early: presence.home_early,
        is_absence: presence.is_absence,
        is_leave: presence.is_leave,
        is_holiday: presence.is_holiday,
        is_permit: presence.is_permit,
        is_custom_presence: presence.is_custom_presence,
        company_name: presence.company
          ? presence.company.company_name || presence.company.name
          : branch.company.company_name || branch.company.name,
        submissions: presence.submission,
        notes
      };

      return res.status(200).json(response(true, 'Data detail presensi berhasil didapatkan', data));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

const getBonusOrPenalty = async (idEmployee, presenceDate) => {
  const bonusOrPenalty = await Journal.findAll({
    where: [
      { employee_id: idEmployee, type: 'other' },
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

const getAllowances = async (idEmployee, presenceDate) => {
  const allowances = await Journal.findAll({
    where: [
      { employee_id: idEmployee, type: 'allowance' },
      Sequelize.where(
        Sequelize.fn('DATE_FORMAT', Sequelize.col('journals.created_at'), '%Y-%m-%d'),
        presenceDate
      )
    ],
    include: { model: Allowance, attributes: ['name', 'type'], required: false }
  });

  return allowances;
};

const getEmployeeNotes = async (idEmployee, presenceDate) => {
  const notes = await EmployeeNote.findOne({
    where: { employee_id: idEmployee, type: null, date: presenceDate },
    attributes: ['id', 'date', 'notes']
  });

  return notes;
};

module.exports = presencesService;

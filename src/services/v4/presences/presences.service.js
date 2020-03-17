require('module-alias/register');
const { response } = require('@helpers');
const {
  sequelize,
  digital_assets: DigitalAsset,
  employees: Employee,
  companies: Company,
  company_settings: CompanySetting,
  presences: Presence,
  salary_groups: SalaryGroup,
  allowance: Allowance,
  journals: Journal,
  employee_notes: EmployeeNote
} = require('@models');
const config = require('config');
const {
  countWorkdays,
  countTotalSchedule,
  dateProcessor,
  scheduleTemplates: scheduleTemplatesHelpers,
  definedSchedules: definedSchedulesHelpers
} = require('@helpers');

const presenceService = {
  createPresenceManual: async (req, res) => {
    const { employeeId } = res.local.users;
    const { type } = req.query;
    const start = new Date(req.body.presence_start);
    const end = new Date(req.body.presence_end);
    const transaction = await sequelize.transaction();

    try {
      if (start == 'Invalid Date' || end == 'Invalid Date') {
        return res.status(422).json(response(false, 'Input date must yyyy-mm-dd format'));
      }

      const currentUser = await Employee.findOne({
        where: { id: employeeId },
        attributes: ['id'],
        include: {
          model: Company,
          attributes: ['id'],
          include: { model: CompanySetting, attributes: ['payroll_date'], as: 'setting' }
        }
      });

      const rangedDate = dateProcessor.getRangedDate(currentUser.company.setting.payroll_date);

      let arrayDate = [];
      while (start <= end) {
        arrayDate.push(
          `${start.getFullYear()}-${('0' + (start.getMonth() + 1)).slice(-2)}-${(
            '0' + start.getDate()
          ).slice(-2)}`
        );
        start.setDate(start.getDate() + 1);
      }

      let payloadPresence = [];
      let journalPayloads = [];
      let payloadNotes = [];
      let payloadUploads = [];

      let createPresences;
      let employeeNotes;
      let digitalAsset;

      for (const date of arrayDate) {
        for (const employee_id of req.body.employee_id) {
          const createdAt = new Date(`${new Date(date)} +0700`);

          const presence = await Presence.findOne({
            where: { employee_id: employee_id, presence_date: date }
          });

          if (presence)
            return res
              .status(422)
              .json(
                response(
                  false,
                  `Presence with member_id ${employee_id} and presence date ${date} already exist`
                )
              );

          const employee = await Employee.findOne({
            where: { id: employee_id },
            include: {
              model: SalaryGroup,
              through: { attributes: ['id'] }
            }
          });

          if (employee.salary_groups.length && req.body.is_back_date === '0') {
            let workdays;
            if (employee.salary_groups[0].daily_frequent) {
              const dailyFrequent = employee.salary_groups[0].daily_frequent;
              workdays = countWorkdays(dailyFrequent, rangedDate.dateStart, rangedDate.dateEnd);
            } else {
              workdays = await countTotalSchedule(
                employee.id,
                rangedDate.dateStart,
                rangedDate.dateEnd
              );
            }

            if (workdays) {
              if (type === 'attend') {
                const allowances = await Allowance.findAll({
                  where: { salary_groups_id: employee.salary_groups[0].id, type: 1 },
                  attributes: ['id', 'amount', 'name']
                });

                if (allowances.length) {
                  for (const allowance of allowances) {
                    journalPayloads.push({
                      employee_id: employee_id,
                      type: 'allowance',
                      salary_groups_id: null,
                      allowance_id: allowance.id,
                      debet: allowance.amount,
                      description: `Tunjangan ${allowance.name} tanggal ${date}`,
                      include_launch_allowance: 0,
                      include_transport_allowance: 0,
                      created_at: createdAt
                    });
                  }
                }
              }

              journalPayloads.push({
                employee_id: employee_id,
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
            employee_id: employee_id,
            company_id: employee.company_id,
            presence_date: date
          };

          switch (type) {
            case 'attend':
              presencePayload;
              break;
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
          payloadPresence.push(presencePayload);

          const notes = await EmployeeNote.findOne({
            where: { date: start, employee_id: employee_id }
          });

          if (notes)
            return res
              .status(400)
              .json(response(false, 'Create note cannot be more than one, please specify note_id'));

          if (req.body.note) {
            const data = {
              employee_id: employee_id,
              type: null,
              date: date,
              notes: req.body.note,
              amount: null,
              created_at: createdAt
            };

            payloadNotes.push(data);
          }

          const host =
            process.env.NODE_ENV !== 'production'
              ? `http://${config.host}:${config.port}/`
              : `http://${config.host}/`;

          if (req.file) {
            const filepath = req.file.path.split('/')[1];
            let digitalAssetPayload = {
              type: 'manual',
              uploadable_type: 'presences',
              uploadable_id: employee_id,
              path: req.file.path,
              filename: req.file.filename,
              mime_type: req.file.mimetype,
              url: `${host}${filepath}/${req.file.filename}`
            };
            payloadUploads.push(digitalAssetPayload);
          }
        }
      }

      createPresences = await Presence.bulkCreate(payloadPresence, { transaction });

      if (req.body.note) {
        employeeNotes = await EmployeeNote.bulkCreate(payloadNotes, { transaction });

        if (!employeeNotes) {
          await transaction.rollback();
          return res.status(400).json(response(false, 'Gagal membuat employee notes'));
        }
      }

      if (req.file) {
        digitalAsset = await DigitalAsset.bulkCreate(payloadUploads, { transaction });
        if (!digitalAsset) {
          await transaction.rollback();
          return res.status(400).json(response(false, 'Gagal membuat digital assets'));
        }
      }

      if (!createPresences) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal membuat presensi manual'));
      }

      if (journalPayloads.length) {
        const createJournals = await Journal.bulkCreate(journalPayloads, { transaction });
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

  createPresenceManualNow: async (req, res) => {
    const { employeeId } = res.local.users;
    const { data } = req.body;
    const transaction = await sequelize.transaction();

    try {
      const currentUser = await Employee.findOne({
        where: { id: employeeId },
        attributes: ['id'],
        include: {
          model: Company,
          attributes: ['id'],
          include: { model: CompanySetting, attributes: ['payroll_date'], as: 'setting' }
        }
      });

      const employee = await Employee.findOne({
        where: { id: data.employee_id },
        include: {
          model: SalaryGroup,
          through: { attributes: ['id'] }
        }
      });

      const scheduleTemplates = await scheduleTemplatesHelpers(
        data.date,
        data.employee_id,
        employee.company_id
      );

      const definedSchedules = await definedSchedulesHelpers(
        data.date,
        employee.company_id,
        data.employee_id
      );
      const schedules = scheduleTemplates.concat(definedSchedules);
      if (!schedules || schedules.length <= 0) {
        return res.status(400).json(response(false, `Jadwal Tidak Ditemukan`));
      }
      const sch_start = schedules[0].shift.schedule_shift.start_time;
      const sch_end = schedules[0].shift.schedule_shift.end_time;

      // save data to presences table
      let journalPayloads;
      const presence = await Presence.findOne({
        where: { employee_id: data.employee_id, presence_date: data.date }
      });
      if (presence) {
        return res
          .status(422)
          .json(
            response(
              false,
              `Presence with member_id ${data.employee_id} and presence_date ${data.date} already axist`
            )
          );
      }

      const createdAt = new Date(`${new Date(data.date)} +0700`);
      const newDate = currentUser.company.setting.payroll_date;

      if (employee.salary_groups.length) {
        let workdays;
        if (employee.salary_groups[0].daily_frequent) {
          const dailyFrequent = employee.salary_groups[0].daily_frequent;
          workdays = countWorkdays(dailyFrequent, newDate.dateStart, newDate.dateEnd);
        } else {
          workdays = await countTotalSchedule(employee.id, newDate.dateStart, newDate.dateEnd);
        }

        if (workdays) {
          if (data.type === 'attend') {
            const allowances = await Allowance.findAll({
              where: { salary_groups_id: employee.salary_groups[0].id, type: 1 },
              attributes: ['id', 'amount', 'name']
            });

            if (allowances.length) {
              for (const allowance of allowances) {
                journalPayloads = {
                  employee_id: data.employee_id,
                  type: 'allowance',
                  salary_groups_id: null,
                  allowance_id: allowance.id,
                  debet: allowance.amount,
                  description: `Tunjangan ${allowance.name} tanggal ${data.date}`,
                  include_launch_allowance: 0,
                  include_transport_allowance: 0,
                  created_at: createdAt
                };
              }
            }
          }

          journalPayloads = {
            employee_id: data.employee_id,
            type: 'salary',
            salary_groups_id: employee.salary_groups[0].id,
            debet: parseInt(employee.salary_groups[0].salary) / parseInt(workdays),
            description: `Gaji tanggal ${data.date}`,
            include_lunch_allowance: data.type === 'attend' ? 1 : 0,
            include_transport_allowance: data.type === 'attend' ? 1 : 0,
            created_at: createdAt
          };
        }
      }

      let presencePayload = {
        employee_id: data.employee_id,
        company_id: employee.company_id,
        presence_date: data.date
      };

      if (data.type === 'attend') {
        presencePayload.presence_start = data.date + ' ' + sch_start;
        presencePayload.presence_end = data.date + ' ' + sch_end;
      } else if (data.type === 'absence') {
        presencePayload.is_absence = 1;
      }

      const createPresences = await Presence.create(presencePayload, { transaction });

      if (!createPresences) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal membuat presensi manual'));
      }

      if (journalPayloads) {
        const createJournals = await Journal.bulkCreate(journalPayloads, { transaction });
        if (!createJournals) {
          await transaction.rollback();
          return res.status(400).json(response(false, 'Gagal membuat presensi manual'));
        }
      }

      await transaction.commit();

      return res
        .status(201)
        .json(response(true, 'Presensi manual berhasil dibuat', createPresences));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};
module.exports = presenceService;

require('module-alias/register');
const { response, findRangedSchedules } = require('@helpers');
const {
  schedule_templates: ScheduleTemplate,
  defined_schedules: DefinedSchedule,
  employees: Employee,
  companies: Company,
  users: User,
  digital_assets: DigitalAsset,
  presences: Presences,
  company_settings: CompanySetting
} = require('@models');
const Sequelize = require('sequelize');

const scheduleService = {
  /*
   * Get detail schedule data by id
   */
  find: async (req, res) => {
    const { schedule_id: scheduleId } = req.params;
    const { type } = req.query;

    try {
      let scheduleData;

      if (type === 'once') {
        scheduleData = await DefinedSchedule.findOne({
          where: { id: scheduleId }
        });
        if (!scheduleData) {
          return res.status(400).json(response(false, 'Defined Schedule not found'));
        }
      }
      if (type === 'continous') {
        scheduleData = await ScheduleTemplate.findOne({
          where: { id: scheduleId }
        });
        if (!scheduleData) {
          return res.status(400).json(response(false, 'Schedule Template not found'));
        }
      }

      return res.status(200).json(response(true, 'Schedule successfully retrieved', scheduleData));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  /*
   * Get complete schedule data of all employee by company id
   */
  get: async (req, res) => {
    const { company_id: companyId } = req.params;
    const { date } = req.query;
    const { employeeId } = res.local.users;
    let responseData = [];

    try {
      const companyData = await Company.findOne({
        where: {
          id: companyId
        }
      });
      if (!companyData) {
        return res.status(400).json(response(false, `Failed to fetch: company data doesn't exist`));
      }

      const isMember = await Employee.findOne({
        where: { id: employeeId, role: 2 }
      });

      let scheduleTemplates = await ScheduleTemplate.findAll({
        where: [
          Sequelize.where(
            Sequelize.fn(
              'IF',
              Sequelize.col('deleted_date'),
              Sequelize.col('deleted_date'),
              '2999-12-31'
            ),
            'NOT LIKE',
            `%${date}%`
          ),
          {
            $not: [
              Sequelize.where(
                Sequelize.fn(
                  'DATE_FORMAT',
                  Sequelize.fn(
                    'IF',
                    Sequelize.col('deleted_after'),
                    Sequelize.col('deleted_after'),
                    '2999-12-31'
                  ),
                  '%Y-%m-%d'
                ),
                '<=',
                date
              )
            ]
          },
          {
            $not: [
              Sequelize.where(
                Sequelize.fn(
                  'DATE_FORMAT',
                  Sequelize.fn(
                    'IF',
                    Sequelize.col('end_repeat'),
                    Sequelize.col('end_repeat'),
                    '2999-12-31'
                  ),
                  '%Y-%m-%d'
                ),
                '<=',
                date
              )
            ]
          },
          isMember !== null && { employee_id: employeeId },
          Sequelize.or(
            {
              start_date: {
                $lte: date
              },
              end_date: {
                $gte: date
              }
            },
            [
              {
                start_date: {
                  $lte: date
                }
              },
              Sequelize.literal(`CASE
                WHEN repeat_type = 'yearly'
                  THEN (FLOOR(DATEDIFF('${date}', DATE_FORMAT(end_date, '%Y-%m-%d'))/365 + 1) % yearly_frequent) = 0
                  AND (yearly_frequent_months LIKE CONCAT('%', MONTH('${date}'), '%') OR (WEEK('${date}', 0) - WEEK(DATE_SUB('${date}', INTERVAL DAYOFMONTH('${date}') - 1 DAY), 0) + 1) = yearly_frequent_custom_count AND DAYOFWEEK('${date}') = yearly_frequent_custom_days)
                WHEN repeat_type = 'monthly'
                  THEN (FLOOR(DATEDIFF('${date}', DATE_FORMAT(end_date, '%Y-%m-%d'))/30 + 1) % monthly_frequent) = 0
                  AND (monthly_frequent_date LIKE CONCAT('%,',DAYOFMONTH('${date}'),',%') or monthly_frequent_date LIKE CONCAT(DAYOFMONTH('${date}'), ',%') or monthly_frequent_date LIKE CONCAT('%,',DAYOFMONTH('${date}'))
                  OR (WEEK('${date}', 0) - WEEK(DATE_SUB('${date}', INTERVAL DAYOFMONTH('${date}') - 1 DAY), 0) + 1) = monthly_frequent_custom_count AND DAYOFWEEK('${date}') = monthly_frequent_custom_days)              
                WHEN repeat_type = 'weekly'
                  THEN (FLOOR(DATEDIFF('${date}', DATE_FORMAT(DATE_SUB(end_date, INTERVAL (DAYOFWEEK(end_date) - 1) DAY), '%Y-%m-%d'))/7 + 1) % weekly_frequent) = 0
                  AND weekly_frequent_days LIKE CONCAT('%', DAYOFWEEK('${date}'), '%')
                WHEN repeat_type = 'daily'
                  THEN (DATEDIFF('${date}', DATE_FORMAT(end_date, '%Y-%m-%d')) % daily_frequent) = 0
               END`)
            ]
          )
        ],
        attributes: ['id', 'start_date', 'end_date', 'start_time', 'end_time'],
        include: [
          {
            model: Employee,
            where: { company_id: companyId },
            attributes: ['id'],
            include: [
              {
                model: DefinedSchedule,
                required: false,
                where: { presence_date: date },
                attributes: ['id', 'presence_date', 'presence_start', 'presence_end']
              },
              {
                model: User,
                attributes: ['full_name']
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
          }
        ]
      });

      // If schedule template still not found, then find only the defined schedule
      if (!scheduleTemplates || scheduleTemplates.length <= 0) {
        scheduleTemplates = await DefinedSchedule.findAll({
          where:
            isMember === null
              ? { presence_date: date }
              : { presence_date: date, employee_id: employeeId },
          include: [
            {
              model: Employee,
              where: { company_id: companyId },
              attributes: ['id', 'user_id'],
              include: [
                {
                  model: User,
                  attributes: ['full_name']
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
            }
          ]
        });

        if (!scheduleTemplates || scheduleTemplates.length <= 0) {
          return res.status(400).json(response(false, 'Tidak ada jadwal tersedia'));
        }

        let definedStartTime;
        let definedEndTime;
        let definedStart;
        let definedEnd;
        let scheduleObj;
        let scheduleArray = [];

        for (let i = 0; i < scheduleTemplates.length; i++) {
          definedStartTime = scheduleTemplates[i].presence_start.split(':');
          definedEndTime = scheduleTemplates[i].presence_end.split(':');
          definedStart = new Date(0, 0, 0, definedStartTime[0], definedStartTime[1], 0);
          definedEnd = new Date(0, 0, 0, definedEndTime[0], definedEndTime[1], 0);

          scheduleObj = {
            id: false,
            defined_id: scheduleTemplates[i].id,
            employee: {
              id: scheduleTemplates[i].employee.id,
              full_name: scheduleTemplates[i].employee.user.full_name,
              assets: scheduleTemplates[i].employee.assets
            },
            schedule_date: scheduleTemplates[i].presence_date,
            schedule_start: scheduleTemplates[i].presence_start,
            schedule_end: scheduleTemplates[i].presence_end,
            workhour: Math.abs(definedStart - definedEnd) / 36e5
          };
          scheduleArray.push(scheduleObj);
        }

        return res
          .status(200)
          .json(response(true, 'Schedule data have been successfully retrieved', scheduleArray));
      }

      let objectData = {};
      if (scheduleTemplates.length > 0) {
        const definedData = await DefinedSchedule.findAll({
          where:
            isMember === null
              ? { presence_date: date }
              : { presence_date: date, employee_id: employeeId },
          include: [
            {
              model: Employee,
              where: { company_id: companyId },
              attributes: ['id', 'user_id'],
              include: [
                {
                  model: User,
                  attributes: ['full_name']
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
            }
          ]
        });

        let definedStartTime;
        let definedEndTime;
        let definedStart;
        let definedEnd;
        let scheduleObj;

        for (let i = 0; i < definedData.length; i++) {
          definedStartTime = definedData[i].presence_start.split(':');
          definedEndTime = definedData[i].presence_end.split(':');
          definedStart = new Date(0, 0, 0, definedStartTime[0], definedStartTime[1], 0);
          definedEnd = new Date(0, 0, 0, definedEndTime[0], definedEndTime[1], 0);

          scheduleObj = {
            id: false,
            defined_id: definedData[i].id,
            employee: {
              id: definedData[i].employee.id,
              full_name: definedData[i].employee.user.full_name,
              assets: definedData[i].employee.assets
            },
            schedule_date: definedData[i].presence_date,
            schedule_start: definedData[i].presence_start,
            schedule_end: definedData[i].presence_end,
            workhour: Math.abs(definedStart - definedEnd) / 36e5
          };
          responseData.push(scheduleObj);
        }

        for (let i = 0; i < scheduleTemplates.length; i++) {
          /* eslint-disable */
          let startTime =
            scheduleTemplates[i].employee.defined_schedules.length > 0
              ? scheduleTemplates[i].employee.defined_schedules[0].presence_start.split(':')
              : scheduleTemplates[i].start_time.split(':');
          let endTime =
            scheduleTemplates[i].employee.defined_schedules.length > 0
              ? scheduleTemplates[i].employee.defined_schedules[0].presence_end.split(':')
              : scheduleTemplates[i].end_time.split(':');
          /* eslint-enable */
          let start = new Date(0, 0, 0, startTime[0], startTime[1], 0);
          let end = new Date(0, 0, 0, endTime[0], endTime[1], 0);

          /* eslint-disable */
          objectData = {
            id: scheduleTemplates[i].id,
            defined_id:
              scheduleTemplates[i].employee.defined_schedules.length > 0 &&
              scheduleTemplates[i].employee.defined_schedules[0].id,
            employee: {
              id: scheduleTemplates[i].employee.id,
              full_name: scheduleTemplates[i].employee.user.full_name,
              assets: scheduleTemplates[i].employee.assets
            },
            schedule_date:
              scheduleTemplates[i].employee.defined_schedules.length > 0
                ? scheduleTemplates[i].employee.defined_schedules[0].presence_date
                : date,
            schedule_start:
              scheduleTemplates[i].employee.defined_schedules.length > 0
                ? scheduleTemplates[i].employee.defined_schedules[0].presence_start
                : scheduleTemplates[i].start_time,
            schedule_end:
              scheduleTemplates[i].employee.defined_schedules.length > 0
                ? scheduleTemplates[i].employee.defined_schedules[0].presence_end
                : scheduleTemplates[i].end_time,
            workhour: Math.abs(start - end) / 36e5
          };
          /* eslint-enable */
          responseData.push(objectData);
        }
      }

      return res
        .status(200)
        .json(response(true, 'Schedule data have been successfully retrieved', responseData));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  /*
   * Create schedule if the data only happen in one day
   * Method once will be used
   */
  once: async (req, res) => {
    const { employee_id: employeeId } = req.params;
    const { data } = req.body;
    let schedules;

    try {
      const employeeData = await Employee.findOne({
        where: {
          id: employeeId
        },
        include: [
          {
            model: Company,
            include: [{ model: CompanySetting, as: 'setting' }]
          }
        ]
      });
      if (!employeeData) {
        return res
          .status(400)
          .json(response(false, `Failed to fetch: employee data doesn't exist`));
      }

      const isAlready = await DefinedSchedule.findOne({
        where: { presence_date: data.presence_date, employee_id: employeeId }
      });

      if (isAlready) {
        return res
          .status(400)
          .json(
            response(
              false,
              `Duplikat: jadwal ${data.presence_date} untuk anggota tertuju sudah ada`
            )
          );
      }

      const payload = Object.assign({}, data, {
        employee_id: employeeId
      });

      schedules = await DefinedSchedule.create(payload);

      // Update Presence Information
      const lastPresence = await Presences.max('presence_date', {
        where: { employee_id: employeeId }
      });

      const presences = await Presences.findAll({
        where: {
          employee_id: employeeId,
          presence_date: { $between: [data.start_date, lastPresence] }
        }
      });

      const rangedSchedules = await findRangedSchedules(
        data.start_date,
        lastPresence,
        employeeData.company_id,
        employeeId
      );

      for (const data of rangedSchedules) {
        const findPresence = presences.filter(val => val.presence_date === data.dataValues.date);
        if (findPresence.length) {
          const startTime = data.start_time || data.presence_start;
          const presence = new Date(findPresence[0].presence_date + ' ' + startTime);
          let overdue = Math.floor(
            (new Date(findPresence[0].presence_start) - presence) / (1000 * 60)
          );
          if (parseInt(overdue) > parseInt(employeeData.company.setting.presence_overdue_limit)) {
            // Insert presence overdue if beyond threshold
            overdue = overdue - employeeData.company.setting.presence_overdue_limit;
          } else {
            overdue = 0;
          }
          await Presences.update(
            { presence_overdue: overdue },
            { where: { id: findPresence[0].id } }
          );
        }
      }

      if (!schedules) {
        return res.status(400).json(response(false, `Failed to created schedule`));
      }
      return res
        .status(201)
        .json(response(true, 'Schedule data has been successfully created', schedules));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  /*
   * Create schedule if the data happend continously
   * Method continous will be used as schedule pattern algorithm
   */
  continous: async (req, res) => {
    const { employee_id: employeeId } = req.params;
    const { data } = req.body;
    let schedules;

    try {
      const employeeData = await Employee.findOne({
        where: {
          id: employeeId
        },
        include: [
          {
            model: Company,
            include: [{ model: CompanySetting, as: 'setting' }]
          }
        ]
      });
      if (!employeeData) {
        return res.status(400).json(response(false, `Failed to fetch employee data doesn't exist`));
      }
      const payload = Object.assign({}, data, {
        employee_id: employeeId
      });

      /* eslint-disable */
      schedules = await ScheduleTemplate.findOne({
        where: [
          Sequelize.where(
            Sequelize.fn(
              'IF',
              Sequelize.col('deleted_date'),
              Sequelize.col('deleted_date'),
              '2999-12-31'
            ),
            'NOT LIKE',
            `%${data.start_date}%`
          ),
          {
            $not: [
              Sequelize.where(
                Sequelize.fn(
                  'DATE_FORMAT',
                  Sequelize.fn(
                    'IF',
                    Sequelize.col('deleted_after'),
                    Sequelize.col('deleted_after'),
                    '2999-12-31'
                  ),
                  '%Y-%m-%d'
                ),
                '<=',
                data.start_date
              )
            ]
          },
          {
            $not: [
              Sequelize.where(
                Sequelize.fn(
                  'DATE_FORMAT',
                  Sequelize.fn(
                    'IF',
                    Sequelize.col('end_repeat'),
                    Sequelize.col('end_repeat'),
                    '2999-12-31'
                  ),
                  '%Y-%m-%d'
                ),
                '<=',
                data.start_date
              )
            ]
          },
          {
            employee_id: employeeId
          },
          Sequelize.or(
            Sequelize.or(
              {
                start_date: {
                  $lte: data.start_date
                },
                end_date: {
                  $gte: data.start_date
                }
              },
              [
                {
                  start_date: {
                    $lte: data.start_date
                  }
                },
                Sequelize.literal(`CASE
                  WHEN repeat_type = 'yearly'
                    THEN (FLOOR(DATEDIFF('${
                      data.start_date
                    }', DATE_FORMAT(end_date, '%Y-%m-%d'))/365 + 1) % yearly_frequent) = 0
                    AND (yearly_frequent_months LIKE CONCAT('%', MONTH('${
                      data.start_date
                    }'), '%') OR (WEEK('${data.start_date}', 0) - WEEK(DATE_SUB('${
                  data.start_date
                }', INTERVAL DAYOFMONTH('${
                  data.start_date
                }') - 1 DAY), 0) + 1) = yearly_frequent_custom_count AND DAYOFWEEK('${
                  data.start_date
                }') = yearly_frequent_custom_days)
                  WHEN repeat_type = 'monthly'
                    THEN (FLOOR(DATEDIFF('${
                      data.start_date
                    }', DATE_FORMAT(end_date, '%Y-%m-%d'))/30 + 1) % monthly_frequent) = 0
                    AND (monthly_frequent_date LIKE CONCAT('%,',DAYOFMONTH('${
                      data.start_date
                    }'),',%') or monthly_frequent_date LIKE CONCAT(DAYOFMONTH('${
                  data.start_date
                }'), ',%') or monthly_frequent_date LIKE CONCAT('%,',DAYOFMONTH('${
                  data.start_date
                }'))
                    OR (WEEK('${data.start_date}', 0) - WEEK(DATE_SUB('${
                  data.start_date
                }', INTERVAL DAYOFMONTH('${
                  data.start_date
                }') - 1 DAY), 0) + 1) = monthly_frequent_custom_count AND DAYOFWEEK('${
                  data.start_date
                }') = monthly_frequent_custom_days)
                  WHEN repeat_type = 'weekly'
                  THEN (FLOOR(DATEDIFF('${
                    data.start_date
                  }', DATE_FORMAT(DATE_SUB(end_date, INTERVAL (DAYOFWEEK(end_date) - 1) DAY), '%Y-%m-%d'))/7 + 1) % weekly_frequent) = 0
                    AND weekly_frequent_days LIKE CONCAT('%', DAYOFWEEK('${data.start_date}'), '%')
                  WHEN repeat_type = 'daily'
                    THEN (DATEDIFF('${
                      data.start_date
                    }', DATE_FORMAT(end_date, '%Y-%m-%d')) % daily_frequent) = 0
                END`)
              ]
            ),
            Sequelize.or(
              {
                start_date: {
                  $lte: data.end_date
                },
                end_date: {
                  $gte: data.end_date
                }
              },
              [
                {
                  start_date: {
                    $lte: data.end_date
                  }
                },
                Sequelize.literal(`CASE
                  WHEN repeat_type = 'yearly'
                    THEN (FLOOR(DATEDIFF('${
                      data.end_date
                    }', DATE_FORMAT(end_date, '%Y-%m-%d'))/365 + 1) % yearly_frequent) = 0
                    AND (yearly_frequent_months LIKE CONCAT('%', MONTH('${
                      data.end_date
                    }'), '%') OR (WEEK('${data.end_date}', 0) - WEEK(DATE_SUB('${
                  data.end_date
                }', INTERVAL DAYOFMONTH('${
                  data.end_date
                }') - 1 DAY), 0) + 1) = yearly_frequent_custom_count AND DAYOFWEEK('${
                  data.end_date
                }') = yearly_frequent_custom_days)
                  WHEN repeat_type = 'monthly'
                    THEN (FLOOR(DATEDIFF('${
                      data.end_date
                    }', DATE_FORMAT(end_date, '%Y-%m-%d'))/30 + 1) % monthly_frequent) = 0
                    AND (monthly_frequent_date LIKE CONCAT('%,',DAYOFMONTH('${
                      data.end_date
                    }'),',%') or monthly_frequent_date LIKE CONCAT(DAYOFMONTH('${
                  data.end_date
                }'), ',%') or monthly_frequent_date LIKE CONCAT('%,',DAYOFMONTH('${data.end_date}'))
                    OR (WEEK('${data.end_date}', 0) - WEEK(DATE_SUB('${
                  data.end_date
                }', INTERVAL DAYOFMONTH('${
                  data.end_date
                }') - 1 DAY), 0) + 1) = monthly_frequent_custom_count AND DAYOFWEEK('${
                  data.end_date
                }') = monthly_frequent_custom_days)
                  WHEN repeat_type = 'weekly'
                  THEN (FLOOR(DATEDIFF('${
                    data.end_date
                  }', DATE_FORMAT(DATE_SUB(end_date, INTERVAL (DAYOFWEEK(end_date) - 1) DAY), '%Y-%m-%d'))/7 + 1) % weekly_frequent) = 0
                    AND weekly_frequent_days LIKE CONCAT('%', DAYOFWEEK('${data.end_date}'), '%')
                  WHEN repeat_type = 'daily'
                    THEN (DATEDIFF('${
                      data.end_date
                    }', DATE_FORMAT(end_date, '%Y-%m-%d')) % daily_frequent) = 0
                END`)
              ]
            )
          )
        ]
      });
      /* eslint-enable */
      if (schedules) {
        return res
          .status(422)
          .json(
            response(
              false,
              `Schedule between the date ${data.start_date} and ${data.end_date} is already exist`
            )
          );
      }

      schedules = await ScheduleTemplate.create(payload);

      // Update Presence Information
      const lastPresence = await Presences.max('presence_date', {
        where: { employee_id: employeeId }
      });

      const presences = await Presences.findAll({
        where: {
          employee_id: employeeId,
          presence_date: { $between: [data.start_date, lastPresence] }
        }
      });

      const rangedSchedules = await findRangedSchedules(
        data.start_date,
        lastPresence,
        employeeData.company_id,
        employeeId
      );

      for (const data of rangedSchedules) {
        const findPresence = presences.filter(val => val.presence_date === data.dataValues.date);
        if (findPresence.length) {
          const startTime = data.start_time || data.presence_start;
          const presence = new Date(findPresence[0].presence_date + ' ' + startTime);
          let overdue = Math.floor(
            (new Date(findPresence[0].presence_start) - presence) / (1000 * 60)
          );
          if (parseInt(overdue) > parseInt(employeeData.company.setting.presence_overdue_limit)) {
            // Insert presence overdue if beyond threshold
            overdue = overdue - employeeData.company.setting.presence_overdue_limit;
          } else {
            overdue = 0;
          }
          await Presences.update(
            { presence_overdue: overdue },
            { where: { id: findPresence[0].id } }
          );
        }
      }

      if (!schedules) {
        return res.status(400).json(response(false, `Failed to create schedule`));
      }
      return res
        .status(201)
        .json(response(true, 'Schedule data has been successfully created', schedules));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  /*
   * Edit schedule if the data only happen in one day
   * Method editOnce will be used also create new if there no available
   */
  editOnce: async (req, res) => {
    const { schedule_id: scheduleId } = req.params;
    const { data } = req.body;

    try {
      let scheduleData = await DefinedSchedule.findOne({
        where: {
          id: scheduleId
        }
      });
      if (!scheduleData) {
        scheduleData = await ScheduleTemplate.findOne({
          where: { id: scheduleId }
        });
        if (!scheduleData) {
          return res
            .status(400)
            .json(response(false, `Failed to fetch: schedule data doesn't exist`));
        }

        const isAlready = await DefinedSchedule.findOne({
          where: {
            presence_date: data.presence_date,
            employee_id: data.employee_id
          }
        });

        if (isAlready) {
          return res
            .status(400)
            .json(
              response(
                false,
                `Duplikat: jadwal ${data.presence_date} untuk anggota tertuju sudah ada`
              )
            );
        }

        const payload = Object.assign({}, data, {
          employee_id: scheduleData.employee_id
        });
        scheduleData = await DefinedSchedule.create(payload);

        return res
          .status(201)
          .json(response(true, 'Successfully created defined schedule', scheduleData));
      }

      const employeeData = await Employee.findOne({
        where: {
          id: scheduleData.employeeId
        },
        include: [
          {
            model: Company,
            include: [{ model: CompanySetting, as: 'setting' }]
          }
        ]
      });

      scheduleData = await DefinedSchedule.update(data, {
        where: { id: scheduleId }
      });
      if (!scheduleData) {
        return res.status(400).json(response(false, `Failed to update schedule`));
      }

      // Update Presence Information
      const lastPresence = await Presences.max('presence_date', {
        where: { employee_id: employeeData.id }
      });

      const presences = await Presences.findAll({
        where: {
          employee_id: employeeData.id,
          presence_date: { $between: [data.start_date, lastPresence] }
        }
      });

      const rangedSchedules = await findRangedSchedules(
        data.start_date,
        lastPresence,
        employeeData.company_id,
        employeeData.id
      );

      for (const data of rangedSchedules) {
        const findPresence = presences.filter(val => val.presence_date === data.dataValues.date);
        if (findPresence.length) {
          const startTime = data.start_time || data.presence_start;
          const presence = new Date(findPresence[0].presence_date + ' ' + startTime);
          let overdue = Math.floor(
            (new Date(findPresence[0].presence_start) - presence) / (1000 * 60)
          );
          if (parseInt(overdue) > parseInt(employeeData.company.setting.presence_overdue_limit)) {
            // Insert presence overdue if beyond threshold
            overdue = overdue - employeeData.company.setting.presence_overdue_limit;
          } else {
            overdue = 0;
          }
          await Presences.update(
            { presence_overdue: overdue },
            { where: { id: findPresence[0].id } }
          );
        }
      }

      scheduleData = await DefinedSchedule.findOne({
        where: {
          id: scheduleId
        }
      });
      return res
        .status(200)
        .json(response(true, 'Schedule data has been successfully updated', scheduleData));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  /*
   * Edit schedule if the data happen continously
   * Method editContinous will be used
   * Also create new data if edit request have different date with schedule id
   */
  editContinous: async (req, res) => {
    const { schedule_id: scheduleId } = req.params;
    const { data } = req.body;

    try {
      let scheduleData = await ScheduleTemplate.findOne({
        where: {
          id: scheduleId
        }
      });
      if (!scheduleData) {
        const isDefined = await DefinedSchedule.findOne({
          where: { id: scheduleId }
        });
        if (isDefined) {
          await DefinedSchedule.destroy({ where: { id: scheduleId } });
        }
        scheduleData = await ScheduleTemplate.create(data);
        if (scheduleData) {
          return res.status(200).json(response(true, `Berhasil mengedit jadwal`));
        }
        return res.status(400).json(response(false, `Failed to edit: schedule not created`));
      }

      const employeeData = await Employee.findOne({
        where: {
          id: scheduleData.employee_id
        },
        include: [
          {
            model: Company,
            include: [{ model: CompanySetting, as: 'setting' }]
          }
        ]
      });

      if (scheduleData.start_date === data.start_date && scheduleData.end_date === data.end_date) {
        scheduleData = await ScheduleTemplate.update(data, {
          where: { id: scheduleId }
        });
      } else if (
        scheduleData.start_date !== data.start_date ||
        scheduleData.end_date !== data.end_date
      ) {
        const payload = Object.assign({}, data, {
          employee_id: scheduleData.employee_id
        });
        const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds

        const firstDate = new Date(scheduleData.start_date);
        const secondDate = new Date(data.start_date);
        firstDate.setHours(0, 0, 0);
        secondDate.setHours(0, 0, 0);
        const diffDays = Math.ceil(Math.abs((firstDate.getTime() - secondDate.getTime()) / oneDay));

        let scheduleArrays = [];
        if (diffDays > 0) {
          const presenceDate = new Date(data.start_date);
          presenceDate.setHours(0, 0, 0);
          for (let i = 1; i <= diffDays; i++) {
            scheduleArrays.push({
              employee_id: scheduleData.employee_id,
              presence_date: `${presenceDate.getFullYear()}-${(
                '0' +
                (presenceDate.getMonth() + 1)
              ).slice(-2)}-${presenceDate.getDate()}`,
              presence_start: data.start_date,
              presence_end: data.end_date
            });

            presenceDate.setDate(presenceDate.getDate() + 1);
          }
          scheduleData = await DefinedSchedule.bulkCreate(scheduleArrays);
        }

        scheduleData = await ScheduleTemplate.update(payload, {
          where: { id: scheduleId }
        });
      }

      // Update Presence Information
      const lastPresence = await Presences.max('presence_date', {
        where: { employee_id: employeeData.id }
      });
      const presences = await Presences.findAll({
        where: {
          employee_id: employeeData.id,
          presence_date: { $between: [data.start_date, lastPresence] }
        }
      });
      const rangedSchedules = await findRangedSchedules(
        data.start_date,
        lastPresence,
        employeeData.company_id,
        employeeData.id
      );

      for (const data of rangedSchedules) {
        const findPresence = presences.filter(val => val.presence_date === data.dataValues.date);
        if (findPresence.length) {
          const startTime = data.start_time || data.presence_start;
          const presence = new Date(findPresence[0].presence_date + ' ' + startTime);
          let overdue = Math.floor(
            (new Date(findPresence[0].presence_start) - presence) / (1000 * 60)
          );
          if (parseInt(overdue) > parseInt(employeeData.company.setting.presence_overdue_limit)) {
            // Insert presence overdue if beyond threshold
            overdue = overdue - employeeData.company.setting.presence_overdue_limit;
          } else {
            overdue = 0;
          }
          await Presences.update(
            { presence_overdue: overdue },
            { where: { id: findPresence[0].id } }
          );
        }
      }

      if (!scheduleData) {
        return res.status(400).json(response(false, `Failed to update schedule`));
      }
      scheduleData = await ScheduleTemplate.findOne({
        where: {
          id: scheduleId
        }
      });
      return res
        .status(200)
        .json(response(true, 'Schedule data has been successfully updated', scheduleData));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  /*
   * Deleting schedule data
   * If request type this,
   * then only delete defined schedule and update deleted_date
   * If request type after,
   * then delete defined schedule after the date also update deleted_after
   */
  delete: async (req, res) => {
    const {
      employee_id: employeeId,
      defined_id: definedId,
      schedule_id: scheduleId,
      delete_type: deleteType,
      delete_date: deleteDate
    } = req.body.data;
    let deleteSchedule;

    try {
      if (deleteType.toString() === 'this') {
        if (definedId) {
          deleteSchedule = await DefinedSchedule.destroy({
            where: { id: definedId }
          });
        }

        if (scheduleId) {
          deleteSchedule = await ScheduleTemplate.findOne({
            where: { id: scheduleId }
          });

          let deleteDateList;
          if (deleteSchedule.deleted_date) {
            deleteDateList = `${deleteSchedule.deleted_date},${deleteDate}`;
          } else {
            deleteDateList = deleteDate;
          }

          deleteSchedule = await ScheduleTemplate.update(
            {
              deleted_date: deleteDateList
            },
            { where: { id: scheduleId } }
          );
        }
      } else if (deleteType.toString() === 'after') {
        deleteSchedule = await DefinedSchedule.destroy({
          where: {
            employee_id: employeeId,
            presence_date: { $gte: deleteDate }
          }
        });
        if (scheduleId) {
          deleteSchedule = await ScheduleTemplate.update(
            {
              deleted_after: `${deleteDate},`
            },
            { where: { id: scheduleId } }
          );
        }
      }

      if (!deleteSchedule) {
        return res.status(400).json(response(false, 'Nothing deleted'));
      }

      return res.status(200).json(response(true, 'Schedule deleted'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = scheduleService;

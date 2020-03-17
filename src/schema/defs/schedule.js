const { gql } = require('apollo-server-express');
const Sequelize = require('sequelize');

const {
  schedule_templates: ScheduleTemplate,
  defined_schedules: DefinedSchedule,
  employees: Employee,
  users: User
} = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');

/**
 * Schedule Graphql Defs
 */

// TypeDef of Schedule

const typeDef = gql`
  extend type Query {
    schedules(employee_id: Int!, company_id: Int!, year: String!, month: String!): [Schedules]!
  }

  type Schedules {
    full_name: String
    schedule_date: String
    schedule_start: String
    schedule_end: String
    workhour: Float
  }
`;

// Schedule Resolvers
const resolvers = {
  Query: {
    schedules: async (root, params) => {
      const { employee_id: employeeId, company_id: companyId, month, year } = params;
      try {
        // Find Ranged Date in a Month
        let arrayDate = [];
        let responseData = [];
        const totalDays = new Date(
          new Date(year, month).getFullYear(),
          new Date(year, month).getMonth(),
          0
        ).getDate();
        for (let i = 1; i <= totalDays; i++) {
          const findDate = new Date(year, month - 1).setDate(i);
          const rawDate = new Date(findDate);
          const date = `${rawDate.getFullYear()}-${rawDate.getMonth() + 1}-${
            rawDate.getDate().toString().length === 1 ? `0${rawDate.getDate()}` : rawDate.getDate()
          }`;
          arrayDate.push(date);
        }
        // Find Schedule
        for (let i = 0; i < arrayDate.length; i++) {
          const date = arrayDate[i];
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
              { employee_id: employeeId },
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
                  }
                ]
              }
            ]
          });

          // If schedule template still not found, then find only the defined schedule
          if (!scheduleTemplates || scheduleTemplates.length <= 0) {
            scheduleTemplates = await DefinedSchedule.findAll({
              where: { presence_date: date, employee_id: employeeId },
              include: [
                {
                  model: Employee,
                  where: { company_id: companyId },
                  attributes: ['id', 'user_id'],
                  include: [
                    {
                      model: User,
                      attributes: ['full_name']
                    }
                  ]
                }
              ]
            });
            if (scheduleTemplates || scheduleTemplates.length > 0) {
              let definedStartTime;
              let definedEndTime;
              let definedStart;
              let definedEnd;
              let scheduleObj;

              for (let i = 0; i < scheduleTemplates.length; i++) {
                definedStartTime = scheduleTemplates[i].presence_start.split(':');
                definedEndTime = scheduleTemplates[i].presence_end.split(':');
                definedStart = new Date(0, 0, 0, definedStartTime[0], definedStartTime[1], 0);
                definedEnd = new Date(0, 0, 0, definedEndTime[0], definedEndTime[1], 0);

                scheduleObj = {
                  full_name: scheduleTemplates[i].employee.user.full_name,
                  schedule_date: scheduleTemplates[i].presence_date,
                  schedule_start: scheduleTemplates[i].presence_start,
                  schedule_end: scheduleTemplates[i].presence_end,
                  workhour: Math.abs(definedStart - definedEnd) / 36e5
                };
                responseData.push(scheduleObj);
              }
            }
          } else {
            let objectData = {};
            const definedData = await DefinedSchedule.findAll({
              where: { presence_date: date, employee_id: employeeId },
              include: [
                {
                  model: Employee,
                  where: { company_id: companyId },
                  attributes: ['id', 'user_id'],
                  include: [
                    {
                      model: User,
                      attributes: ['full_name']
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
                full_name: definedData[i].employee.user.full_name,
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
                full_name: scheduleTemplates[i].employee.user.full_name,
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
        }
        return responseData;
      } catch (error) {
        dbError(error);
      }
    }
  }
};

module.exports = {
  typeDef,
  resolvers
};

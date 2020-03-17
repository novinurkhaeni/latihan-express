require('module-alias/register');
const {
  schedule_templates: ScheduleTemplate,
  defined_schedules: DefinedSchedule
} = require('@models');
const Sequelize = require('sequelize');

const findRangedSchedules = async (start, end, companyId, employeeId = null) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  let schedules = [];
  while (startDate <= endDate) {
    const date = `${startDate.getFullYear()}-${('0' + (startDate.getMonth() + 1)).slice(-2)}-${(
      '0' + startDate.getDate()
    ).slice(-2)}`;
    // Schedule Query
    let scheduleTemplates = await ScheduleTemplate.findOne({
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
        employeeId !== null && { employee_id: employeeId },
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
      attributes: ['id', 'start_date', 'end_date', 'start_time', 'end_time']
    });

    // If schedule template still not found, then find only the defined schedule
    if (!scheduleTemplates) {
      scheduleTemplates = await DefinedSchedule.findOne({
        where:
          employeeId === null
            ? { presence_date: date }
            : { presence_date: date, employee_id: employeeId }
      });
    }
    if (scheduleTemplates) {
      scheduleTemplates.dataValues.date = date;
      schedules.push(scheduleTemplates);
    }
    startDate.setDate(startDate.getDate() + 1);
  }
  return schedules;
};

module.exports = findRangedSchedules;

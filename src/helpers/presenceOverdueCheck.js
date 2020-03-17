require('module-alias/register');
const {
  schedule_templates: ScheduleTemplate,
  defined_schedules: DefinedSchedule
} = require('@models');
const Sequelize = require('sequelize');

const presenceOverdueCheck = async (checkin, employeeId) => {
  let todaySchedule;
  let scheduleContinous;
  let calculatePresence;

  const presenceDate = `${checkin.getFullYear()}-${('0' + (checkin.getMonth() + 1)).slice(
    -2
  )}-${checkin.getDate()}`;
  const scheduleOnce = await DefinedSchedule.findOne({
    where: {
      presence_date: presenceDate,
      employee_id: employeeId
    }
  });
  if (scheduleOnce) {
    todaySchedule = new Date(presenceDate + ' ' + scheduleOnce.presence_start);
    calculatePresence = Math.floor((checkin - todaySchedule) / (1000 * 60));
  } else {
    scheduleContinous = await ScheduleTemplate.findOne({
      where: [
        Sequelize.where(
          Sequelize.fn(
            'IF',
            Sequelize.col('deleted_date'),
            Sequelize.col('deleted_date'),
            '2999-12-31'
          ),
          'NOT LIKE',
          `%${presenceDate}%`
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
              presenceDate
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
              presenceDate
            )
          ]
        },
        {
          employee_id: employeeId
        },
        Sequelize.or(
          {
            start_date: {
              $lte: presenceDate
            },
            end_date: {
              $gte: presenceDate
            }
          },
          [
            {
              start_date: {
                $lte: presenceDate
              }
            },
            Sequelize.literal(`CASE
              WHEN repeat_type = 'yearly'
                THEN (FLOOR(DATEDIFF('${presenceDate}', DATE_FORMAT(end_date, '%Y-%m-%d'))/365 + 1) % yearly_frequent) = 0
                AND (yearly_frequent_months LIKE CONCAT('%', MONTH('${presenceDate}'), '%') OR (WEEK('${presenceDate}', 0) - WEEK(DATE_SUB('${presenceDate}', INTERVAL DAYOFMONTH('${presenceDate}') - 1 DAY), 0) + 1) = yearly_frequent_custom_count AND DAYOFWEEK('${presenceDate}') = yearly_frequent_custom_days)
              WHEN repeat_type = 'monthly'
                THEN (FLOOR(DATEDIFF('${presenceDate}', DATE_FORMAT(end_date, '%Y-%m-%d'))/30 + 1) % monthly_frequent) = 0
                AND (monthly_frequent_date LIKE CONCAT('%,',DAYOFMONTH('${presenceDate}'),',%') or monthly_frequent_date LIKE CONCAT(DAYOFMONTH('${presenceDate}'), ',%') or monthly_frequent_date LIKE CONCAT('%,',DAYOFMONTH('${presenceDate}'))
                OR (WEEK('${presenceDate}', 0) - WEEK(DATE_SUB('${presenceDate}', INTERVAL DAYOFMONTH('${presenceDate}') - 1 DAY), 0) + 1) = monthly_frequent_custom_count AND DAYOFWEEK('${presenceDate}') = monthly_frequent_custom_days)
              WHEN repeat_type = 'weekly'
                THEN (FLOOR(DATEDIFF('${presenceDate}', DATE_FORMAT(DATE_SUB(end_date, INTERVAL (DAYOFWEEK(end_date) - 1) DAY), '%Y-%m-%d'))/7 + 1) % weekly_frequent) = 0
                AND weekly_frequent_days LIKE CONCAT('%', DAYOFWEEK('${presenceDate}'), '%')
              WHEN repeat_type = 'daily'
                THEN (DATEDIFF('${presenceDate}', DATE_FORMAT(end_date, '%Y-%m-%d')) % daily_frequent) = 0
            END`)
          ]
        )
      ]
    });
    if (scheduleContinous) {
      todaySchedule = new Date(presenceDate + ' ' + scheduleContinous.start_time);
      calculatePresence = Math.floor((checkin - todaySchedule) / (1000 * 60));
    } else {
      // Set to -1 for validate if value < 0
      calculatePresence = -1;
    }
  }

  const presenceOverdue = calculatePresence < 0 ? 0 : calculatePresence;
  return presenceOverdue;
};

module.exports = presenceOverdueCheck;

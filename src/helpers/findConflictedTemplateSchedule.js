require('module-alias/register');
const { schedule_templates: ScheduleTemplate } = require('@models');
const Sequelize = require('sequelize');

/**
 * To get schedule data by matching to another pattern
 *
 * @param {Object} data {pattern data}
 * @returns Array {Array of date}
 */
const findConflictedTemplateSchedule = async data => {
  let isScheduleExist;
  if (data.repeat_type.toLowerCase() == 'monthly') {
    isScheduleExist = await ScheduleTemplate.findAll({
      where: [
        {
          $or: [
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
                  '>=',
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
                  '>=',
                  data.start_date
                )
              ]
            },
            [
              Sequelize.where(
                Sequelize.fn(
                  'MOD',
                  Sequelize.fn(
                    'IF',
                    Sequelize.col('monthly_frequent') > data.monthly_frequent,
                    Sequelize.col('monthly_frequent'),
                    data.monthly_frequent
                  ),
                  Sequelize.fn(
                    'IF',
                    Sequelize.col('monthly_frequent') > data.monthly_frequent,
                    data.monthly_frequent,
                    Sequelize.col('monthly_frequent')
                  )
                ),
                0
              ),
              {
                monthly_frequent_date: { $regexp: data.monthly_frequent_date.split(',').join('|') }
              }
            ],
            {
              start_date: [data.start_date, data.end_date],
              end_date: [data.start_date, data.end_date],
              employee_id: data.member.map(d => d.employee_id)
            }
          ]
        }
      ]
    });
  } else if (data.repeat_type.toLowerCase() === 'weekly') {
    isScheduleExist = await ScheduleTemplate.findAll({
      where: [
        {
          $or: [
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
                  '>=',
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
                  '>=',
                  data.start_date
                )
              ]
            },
            [
              Sequelize.where(
                Sequelize.fn(
                  'MOD',
                  Sequelize.fn(
                    'IF',
                    Sequelize.col('weekly_frequent') > data.weekly_frequent,
                    Sequelize.col('weekly_frequent'),
                    data.weekly_frequent
                  ),
                  Sequelize.fn(
                    'IF',
                    Sequelize.col('weekly_frequent') > data.weekly_frequent,
                    data.weekly_frequent,
                    Sequelize.col('weekly_frequent')
                  )
                ),
                0
              ),
              {
                weekly_frequent_days: { $regexp: data.weekly_frequent_days.split(',').join('|') }
              }
            ],
            {
              start_date: [data.start_date, data.end_date],
              end_date: [data.start_date, data.end_date],
              employee_id: data.member.map(d => d.employee_id)
            }
          ]
        }
      ]
    });
  }

  return isScheduleExist;
};

module.exports = findConflictedTemplateSchedule;

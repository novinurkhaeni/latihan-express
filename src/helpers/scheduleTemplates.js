require('module-alias/register');
const {
  schedule_templates: ScheduleTemplate,
  defined_schedules: DefinedSchedule,
  division_schedules: DivisionSchedules,
  employees: Employee,
  schedule_shifts: ScheduleShift,
  schedule_shift_details: ScheduleShiftDetails,
  users: User,
  companies: Company,
  digital_assets: DigitalAsset,
  divisions: Divisions,
  salary_groups: SalaryGroup
} = require('@models');
const Sequelize = require('sequelize');
const { Op } = Sequelize;

/**
 * To get ranged schedule template
 *
 * @param {String} date {today date, format: YYYY-MM-DD}
 * @param {Integer} employeeId {id of employee}
 * @param {Integer} companyId {id of company}
 * @param {Array, Integer} [isMember=null] {is function call to member only?}
 * @param {Integer} [companyBranchId=null]
 * @returns Array {Array of date}
 */
const scheduleTemplates = async (
  date,
  employeeId,
  companyId,
  isMember = null,
  companyBranchId = null
) => {
  const schedule = await ScheduleTemplate.findAll({
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
      companyBranchId && { [Op.or]: [{ company_id: companyBranchId }, { company_id: null }] },
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
                    AND (monthly_frequent_date = DAYOFMONTH('${date}') or monthly_frequent_date LIKE CONCAT('%,',DAYOFMONTH('${date}'),',%') or monthly_frequent_date LIKE CONCAT(DAYOFMONTH('${date}'), ',%') or monthly_frequent_date LIKE CONCAT('%,',DAYOFMONTH('${date}'))
                    OR (WEEK('${date}', 0) - WEEK(DATE_SUB('${date}', INTERVAL DAYOFMONTH('${date}') - 1 DAY), 0) + 1) = monthly_frequent_custom_count AND DAYOFWEEK('${date}') = monthly_frequent_custom_days)
                  WHEN repeat_type = 'weekly'
                    THEN (FLOOR(DATEDIFF('${date}', DATE_FORMAT(DATE_SUB(end_date, INTERVAL (DAYOFWEEK(end_date) - 1) DAY), '%Y-%m-%d'))/7 + 1) % weekly_frequent) = 0
                    AND weekly_frequent_days LIKE CONCAT('%', DAYOFWEEK('${date}'), '%')
                  WHEN repeat_type = 'daily'
                    THEN (DATEDIFF('${date}', DATE_FORMAT(end_date, '%Y-%m-%d')) % 'schedule_templates.daily_frequent') = 0
                 END`)
        ]
      )
    ],
    attributes: ['id', 'start_date', 'end_date', 'start_time', 'end_time'],
    include: [
      {
        model: Employee,
        where: [{ active: 1 }, companyId && { company_id: companyId }],
        attributes: ['id'],
        required: true,
        include: [
          {
            model: DefinedSchedule,
            required: false,
            where: { presence_date: date },
            attributes: ['id', 'presence_date', 'presence_start', 'presence_end'],
            include: {
              model: ScheduleShiftDetails,
              where: { schedule_type: 'defined_schedules' },
              as: 'shift',
              include: {
                model: ScheduleShift,
                attributes: ['start_time', 'end_time']
              }
            }
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
      },
      {
        model: Company
      },
      {
        model: ScheduleShiftDetails,
        where: { schedule_type: 'schedule_templates' },
        as: 'shift',
        required: false,
        include: {
          model: ScheduleShift,
          include: { model: SalaryGroup, attributes: ['id', 'salary'] }
        }
      },
      {
        model: DivisionSchedules,
        where: { schedule_type: 'schedule_templates' },
        as: 'division',
        required: false,
        include: {
          model: Divisions
        }
      }
    ]
  });
  return schedule;
};

module.exports = scheduleTemplates;

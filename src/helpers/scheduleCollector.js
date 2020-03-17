const Sequelize = require('sequelize');
const { sequelize, defined_schedules: DefinedSchedule } = require('@models');
const { Op } = Sequelize;

const scheduleCollector = async (employeeId, start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  let queries = '';
  while (startDate <= endDate) {
    const date = `${startDate.getFullYear()}-${('0' + (startDate.getMonth() + 1)).slice(-2)}-${(
      '0' + startDate.getDate()
    ).slice(-2)}`;
    queries += `(SELECT ${'`id`'}, '${date}' as presence_date FROM ${'`schedule_templates`'} AS ${'`schedule_templates`'} WHERE (IF(${'`deleted_date`'}, ${'`deleted_date`'}, '2999-12-31') NOT LIKE '%${date}%' AND NOT (DATE_FORMAT(IF(${'`deleted_after`'}, ${'`deleted_after`'}, '2999-12-31'), '%Y-%m-%d') <= '${date}') AND NOT (DATE_FORMAT(IF(${'`end_repeat`'}, ${'`end_repeat`'}, '2999-12-31'), '%Y-%m-%d') <= '${date}') AND ${'`schedule_templates`'}.${'`employee_id`'} = ${employeeId} AND ((${'`schedule_templates`'}.${'`start_date`'} <= '${date}' AND ${'`schedule_templates`'}.${'`end_date`'} >= '${date}') OR ((${'`schedule_templates`'}.${'`start_date`'} <= '${date}' AND CASE
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
       END)))) LIMIT 1) UNION ALL `;
    startDate.setDate(startDate.getDate() + 1);
  }
  const lastIndex = queries.lastIndexOf('UNION');
  queries = queries.substring(0, lastIndex);
  const totalTemplated = await sequelize.query(queries, { type: Sequelize.QueryTypes.SELECT });
  const totalDefined = await DefinedSchedule.findAll({
    attributes: ['id', 'presence_date'],
    where: [{ employee_id: employeeId, presence_date: { [Op.between]: [start, end] } }]
  });
  let scheduleCombine = totalTemplated.concat(totalDefined);
  return scheduleCombine;
};
module.exports = scheduleCollector;

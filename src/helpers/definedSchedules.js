require('module-alias/register');
const {
  defined_schedules: DefinedSchedule,
  employees: Employee,
  schedule_shifts: ScheduleShift,
  schedule_shift_details: ScheduleShiftDetails,
  users: User,
  companies: Company,
  digital_assets: DigitalAsset,
  division_schedules: DivisionSchedules,
  schedule_notes: ScheduleNote,
  salary_groups: SalaryGroup
} = require('@models');
const { Op } = require('sequelize');

/**
 * To get defined schedule
 *
 * @param {String} today
 * @param {Integer} companyId
 * @param {Array, Integer} [memberId=null]
 * @param {Integer} [companyBranchId=null]
 * @returns
 */
const definedSchedules = async (
  today,
  companyId,
  memberId = null,
  companyBranchId = null,
  getOnlyNonNullMember = false,
  getOnlyNullMember = false,
  hideSubmission = false,
  getWithoutNullMember = true,
  handleNextday = true
) => {
  let date = [today];
  let yesterdayDate = new Date(new Date(today).setDate(new Date(today).getDate() - 1));
  yesterdayDate = `${yesterdayDate.getFullYear()}-${('0' + (yesterdayDate.getMonth() + 1)).slice(
    -2
  )}-${('0' + yesterdayDate.getDate()).slice(-2)}`;
  date.push(yesterdayDate);
  let schedules = [];
  for (let i = 0; i < date.length; i++) {
    const schedule = await DefinedSchedule.findAll({
      where: [
        { presence_date: date[i] },
        memberId && { employee_id: memberId },
        getOnlyNonNullMember && { employee_id: { [Op.ne]: null } },
        getOnlyNullMember && { employee_id: null },
        companyBranchId && { [Op.or]: [{ company_id: companyBranchId }, { company_id: null }] },
        hideSubmission && { status: 0 }
      ],
      include: [
        {
          model: Employee,
          where: [{ active: 1 }, companyId && { company_id: companyId }],
          attributes: ['id', 'user_id'],
          required: getWithoutNullMember,
          include: [
            {
              model: User,
              attributes: ['full_name'],
              required: false
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
          model: Company,
          required: false
        },
        {
          model: ScheduleShiftDetails,
          where: { schedule_type: 'defined_Schedules' },
          required: false,
          as: 'shift',
          include: {
            model: ScheduleShift,
            include: { model: SalaryGroup, attributes: ['id', 'salary'] }
          }
        },
        {
          model: DivisionSchedules,
          where: { schedule_type: 'defined_schedules' },
          as: 'division',
          required: false
        },
        {
          model: ScheduleNote,
          required: false,
          where: { schedule_type: 'defined_schedules' },
          as: 'notes'
        }
      ]
    });
    if (i === 0) {
      for (const data of schedule) {
        if (data.shift && data.shift.schedule_shift.is_tommorow && handleNextday) {
          data.dataValues.end_time_info = 'Esok Hari';
        }
        schedules.push(data);
      }
    } else {
      for (const data of schedule) {
        if (data.shift && data.shift.schedule_shift.is_tommorow && handleNextday) {
          data.dataValues.start_time_info = 'Lanjutan';
          schedules.push(data);
        }
      }
    }
  }
  return schedules;
};

module.exports = definedSchedules;

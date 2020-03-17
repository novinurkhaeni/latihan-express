require('module-alias/register');
const { response } = require('@helpers');
const {
  Sequelize,
  employees: Employee,
  users: User,
  digital_assets: DigitalAsset,
  schedule_shifts: ScheduleShift,
  schedule_shift_details: ScheduleShiftDetail,
  defined_schedules: DefinedSchedule,
  division_schedules: DivisionSchedule,
  companies: Company,
  schedule_swaps: ScheduleSwap,
  schedule_swap_details: ScheduleSwapDetail,
  home_dumps: HomeDump
} = require('@models');
const { Op } = Sequelize;

class ScheduleSubmission {
  constructor(req, res) {
    this.req = req;
    this.res = res;
  }
  async getScheduleSubmission() {
    const { company_id: companyId } = this.req.params;
    const { dateInfo: today } = this.req.query;
    const { employeeId, employeeRole, companyParentId } = this.res.local.users;
    try {
      let dumps = [];
      if (today) {
        dumps = await HomeDump.findAll({
          where: [
            { parent_company_id: companyParentId },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
              today
            )
          ]
        });
      }
      const scheduleSwaps = await ScheduleSwap.findAll({
        where: [
          { company_id: companyId, [Op.or]: [{ status: 0 }, { status: 1 }] },
          employeeRole !== 1 && { [Op.or]: [{ self_id: employeeId }, { away_id: employeeId }] },
          employeeRole === 1 && { status: 1 }
        ],
        include: {
          model: ScheduleSwapDetail,
          include: {
            model: DefinedSchedule,
            required: true,
            include: [
              {
                model: Employee,
                where: { company_id: companyId, active: 1 },
                attributes: ['id', 'user_id'],
                required: true,
                include: [
                  {
                    model: User,
                    attributes: ['full_name'],
                    required: true
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
                required: false,
                attributes: ['company_name', 'name']
              },
              {
                model: DivisionSchedule,
                where: { schedule_type: 'defined_schedules' },
                as: 'division',
                required: false
              }
            ]
          }
        }
      });
      let scheduleSwapsResponse = [];
      for (const scheduleSwap of scheduleSwaps) {
        let description = 'Menunggu Respon Pemilik Usaha';
        let reverseAction;
        const selfSchedule = scheduleSwap.schedule_swap_details.find(
          val => val.defined_schedule.status === 3
        );
        const awaySchedule = scheduleSwap.schedule_swap_details.find(
          val => val.defined_schedule.status === 4
        );
        if (selfSchedule && awaySchedule) {
          if (
            selfSchedule.defined_schedule.employee_id === employeeId &&
            scheduleSwap.status === 0
          ) {
            description = 'Menunggu Respon';
            reverseAction = 'check';
          }
          if (
            selfSchedule.defined_schedule.employee_id !== employeeId &&
            scheduleSwap.status === 0
          ) {
            description = 'Ingin Tukar Jadwal';
            reverseAction = 'respond';
          }
          if (employeeRole === 1) {
            description = 'Tukar Jadwal';
            reverseAction = 'approve';
          }
          const compose = {
            id: scheduleSwap.id,
            employee_id: selfSchedule.defined_schedule.employee.id,
            full_name: selfSchedule.defined_schedule.employee.user.full_name,
            avatar: selfSchedule.defined_schedule.employee.assets.length
              ? selfSchedule.defined_schedule.employee.assets[0].url
              : null,
            start_time: selfSchedule.defined_schedule.presence_date,
            end_time: awaySchedule.defined_schedule.presence_date,
            status: selfSchedule.defined_schedule.status,
            description,
            division: selfSchedule.defined_schedule.division,
            branch:
              selfSchedule.defined_schedule.company.company_name ||
              selfSchedule.defined_schedule.company.name,

            reverse_action: reverseAction,
            rev: employeeRole === 1 && awaySchedule.defined_schedule.employee.user.full_name,
            away_avatar:
              employeeRole === 1 && awaySchedule.defined_schedule.employee.assets.length
                ? awaySchedule.defined_schedule.employee.assets[0].url
                : null,
            created_at: scheduleSwap.created_at,
            can_response: true
          };
          scheduleSwapsResponse.push(compose);
        }
      }
      const scheduleSubmissions = await DefinedSchedule.findAll({
        where: [
          {
            company_id: companyId,
            status: { [Op.or]: [1, 2] }
          },
          employeeRole == 2 && { employee_id: employeeId }
        ],
        include: [
          {
            model: Employee,
            where: { company_id: companyId, active: 1 },
            attributes: ['id', 'user_id'],
            required: true,
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
            required: false,
            attributes: ['company_name', 'name']
          },
          {
            model: ScheduleShiftDetail,
            where: { schedule_type: 'defined_Schedules' },
            required: false,
            as: 'shift',
            include: {
              model: ScheduleShift
            }
          },
          {
            model: DivisionSchedule,
            where: { schedule_type: 'defined_schedules' },
            as: 'division',
            required: false
          }
        ]
      });

      let responses = [];
      for (const data of scheduleSubmissions) {
        const compose = {
          id: data.id,
          employee_id: data.employee_id,
          full_name: data.employee.user.full_name,
          avatar: data.employee.assets.length ? data.employee.assets[0].url : null,
          date: data.presence_date,
          start_time: data.shift.schedule_shift.start_time,
          end_time: data.shift.schedule_shift.end_time,
          status: data.status,
          description: data.status === 1 ? 'Beri Jadwal Untuk Diambil' : 'Ambil Jadwal',
          division: null,
          branch: data.company.company_name || data.company.name,
          can_response: true,
          created_at: data.created_at
        };
        responses.push(compose);
      }
      responses = responses.concat(scheduleSwapsResponse);

      if (employeeRole !== 1 && employeeRole !== 2) {
        responses = responses.map(val => ({
          ...val,
          can_response: val.employee_id !== employeeId
        }));
      }

      if (dumps.length)
        responses = responses.filter(
          item =>
            !dumps.filter(val => {
              return (
                (val.type == 11 || val.type == 12 || val.type == 13) &&
                val.identifier === item.created_at &&
                val.employee_id === item.employee_id
              );
            }).length
        );

      return this.res
        .status(200)
        .json(response(true, 'Data pengajuan presensi berhasil didapatkan', responses));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
}

module.exports = ScheduleSubmission;

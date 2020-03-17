require('module-alias/register');
const { response } = require('@helpers');
const {
  sequelize,
  employees: Employee,
  users: User,
  digital_assets: DigitalAsset,
  schedule_shifts: ScheduleShift,
  schedule_shift_details: ScheduleShiftDetail,
  defined_schedules: DefinedSchedule,
  division_schedules: DivisionSchedule,
  companies: Company,
  schedule_swaps: ScheduleSwapModel,
  schedule_swap_details: ScheduleSwapDetail
} = require('@models');
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

class ScheduleSwap {
  constructor(req, res) {
    this.req = req;
    this.res = res;
  }

  async getScheduleSwapDetail() {
    const { schedule_id: scheduleId } = this.req.params;
    try {
      const scheduleSwap = await ScheduleSwapModel.findOne({
        where: { id: scheduleId },
        include: {
          model: ScheduleSwapDetail,
          include: {
            model: DefinedSchedule,
            include: [
              {
                model: Employee,
                attributes: ['id', 'user_id'],
                required: false,
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
                model: DivisionSchedule,
                where: { schedule_type: 'defined_schedules' },
                as: 'division',
                required: false
              },
              {
                model: ScheduleShiftDetail,
                where: { schedule_type: 'defined_Schedules' },
                required: false,
                as: 'shift',
                include: {
                  model: ScheduleShift
                }
              }
            ]
          }
        }
      });
      const selfData = scheduleSwap.schedule_swap_details.find(
        val => val.defined_schedule.status === 3
      );
      const awayData = scheduleSwap.schedule_swap_details.find(
        val => val.defined_schedule.status === 4
      );

      const responses = {
        id: scheduleSwap.id,
        status: scheduleSwap.status,
        self_data: {
          defined_schedule_id: selfData.defined_schedule.id,
          employee_id: selfData.defined_schedule.employee_id,
          full_name: selfData.defined_schedule.employee.user.full_name,
          avatar: selfData.defined_schedule.employee.assets.length
            ? selfData.defined_schedule.employee.assets[0].url
            : null,
          date: selfData.defined_schedule.presence_date,
          division: selfData.defined_schedule.division,
          shift_name: selfData.defined_schedule.shift.schedule_shift.shift_name,
          start_time: selfData.defined_schedule.shift.schedule_shift.start_time,
          end_time: selfData.defined_schedule.shift.schedule_shift.end_time,
          branch:
            selfData.defined_schedule.company.company_name || selfData.defined_schedule.company.name
        },
        away_data: {
          defined_schedule_id: awayData.defined_schedule.id,
          employee_id: awayData.defined_schedule.employee_id,
          full_name: awayData.defined_schedule.employee.user.full_name,
          avatar: awayData.defined_schedule.employee.assets.length
            ? awayData.defined_schedule.employee.assets[0].url
            : null,
          date: awayData.defined_schedule.presence_date,
          division: awayData.defined_schedule.division,
          shift_name: awayData.defined_schedule.shift.schedule_shift.shift_name,
          start_time: awayData.defined_schedule.shift.schedule_shift.start_time,
          end_time: awayData.defined_schedule.shift.schedule_shift.end_time,
          branch:
            selfData.defined_schedule.company.company_name || selfData.defined_schedule.company.name
        },
        notes: scheduleSwap.note
      };

      return this.res
        .status(200)
        .json(response(true, 'Data tukar jadwal berhasil didapatkan', responses));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }

  async abortScheduleSwap() {
    const { schedule_id: scheduleId } = this.req.params;
    const { employeeId } = this.res.local.users;
    const transaction = await sequelize.transaction();
    try {
      const scheduleSwap = await ScheduleSwapModel.findOne({
        where: { id: scheduleId },
        include: {
          model: ScheduleSwapDetail,
          include: {
            model: DefinedSchedule,
            include: {
              model: Employee,
              include: [
                { model: User, attributes: ['full_name'] },
                { model: Company, attributes: ['parent_company_id'] }
              ]
            }
          }
        }
      });
      for (const schedule of scheduleSwap.schedule_swap_details) {
        const updateDefinedSchedule = await DefinedSchedule.update(
          {
            status: 0
          },
          { where: { id: schedule.defined_schedule.id } },
          { transaction }
        );
        if (!updateDefinedSchedule) {
          await transaction.rollback();
          return this.res.status(400).json(response(false, 'Gagal membatalkan tukar jadwal'));
        }
      }
      // delete schedule swap
      const deleteScheduleSwap = await ScheduleSwapModel.destroy(
        { where: { id: scheduleId } },
        { transaction }
      );
      if (!deleteScheduleSwap) {
        await transaction.rollback();
        return this.res.status(400).json(response(false, 'Gagal membatalkan tukar jadwal'));
      }
      await transaction.commit();

      // Send Notification
      let applicant;
      let respondent;
      const awayData = scheduleSwap.schedule_swap_details.find(
        val => val.defined_schedule.status === 4
      );
      // only send notification if actor is respondent
      if (awayData.defined_schedule.employee_id === employeeId) {
        for (const schedule of scheduleSwap.schedule_swap_details) {
          if (schedule.defined_schedule.status === 3) {
            applicant = {
              fullName: schedule.defined_schedule.employee.user.full_name,
              employeeId: schedule.defined_schedule.employee_id,
              parentCompanyId: schedule.defined_schedule.employee.company.parent_company_id
            };
          }
          if (schedule.defined_schedule.status === 4) {
            respondent = {
              fullName: schedule.defined_schedule.employee.user.full_name,
              employeeId: schedule.defined_schedule.employee_id
            };
          }
        }
        observe.emit(EVENT.SCHEDULE_SWAP_AGREEMENT, {
          applicant,
          respondent,
          type: 'disagree',
          parentCompanyId: applicant.parentCompanyId
        });
      }

      return this.res
        .status(200)
        .json(response(true, 'Permintaan tukar jadwal berhasil dibatalkan'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }

  async agreedScheduleSwap() {
    const { schedule_id: scheduleId } = this.req.params;
    try {
      const checkScheduleSwap = await ScheduleSwapModel.findOne({ where: { id: scheduleId } });
      if (!checkScheduleSwap) {
        return this.res
          .status(400)
          .json(response(false, 'Permintaan pertukaran jadwal tidak ditemukan'));
      }
      const updateScheduleSwap = await ScheduleSwapModel.update(
        { status: 1 },
        { where: { id: scheduleId } }
      );
      if (!updateScheduleSwap) {
        return this.res
          .status(400)
          .json(response(false, 'Gagal menyetujui permintaan tukar jadwal'));
      }
      // send notification
      let applicant;
      let respondent;
      const scheduleSwap = await ScheduleSwapModel.findOne({
        where: { id: scheduleId },
        include: {
          model: ScheduleSwapDetail,
          include: {
            model: DefinedSchedule,
            include: {
              model: Employee,
              include: [
                { model: User, attributes: ['full_name'] },
                { model: Company, attributes: ['parent_company_id'] }
              ]
            }
          }
        }
      });
      for (const schedule of scheduleSwap.schedule_swap_details) {
        if (schedule.defined_schedule.status === 3) {
          applicant = {
            fullName: schedule.defined_schedule.employee.user.full_name,
            employeeId: schedule.defined_schedule.employee_id,
            parentCompanyId: schedule.defined_schedule.employee.company.parent_company_id
          };
        }
        if (schedule.defined_schedule.status === 4) {
          respondent = {
            fullName: schedule.defined_schedule.employee.user.full_name,
            employeeId: schedule.defined_schedule.employee_id
          };
        }
      }
      observe.emit(EVENT.SCHEDULE_SWAP_AGREEMENT, {
        applicant,
        respondent,
        type: 'agree',
        parentCompanyId: applicant.parentCompanyId
      });
      return this.res
        .status(200)
        .json(response(true, 'Permintaan tukar jadwal berhasil disetujui'));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
}

module.exports = ScheduleSwap;

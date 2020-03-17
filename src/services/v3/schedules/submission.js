/* eslint-disable indent */
require('module-alias/register');
const { response } = require('@helpers');
const {
  Sequelize: { Op }
} = require('sequelize');
const {
  sequelize,
  employees: Employee,
  users: User,
  digital_assets: DigitalAsset,
  schedule_shifts: ScheduleShift,
  schedule_shift_details: ScheduleShiftDetail,
  defined_schedules: DefinedSchedule,
  companies: Company,
  schedule_swaps: ScheduleSwap,
  schedule_swap_details: ScheduleSwapDetail,
  schedule_submissions: ScheduleSubmission,
  schedule_notes: ScheduleNote
} = require('@models');
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

class Submission {
  constructor(req, res) {
    this.res = res;
    this.req = req;
  }

  async getScheduleSubmissionDetail() {
    const { schedule_id } = this.req.params;
    try {
      const submissionData = await DefinedSchedule.findOne({
        where: { id: schedule_id },
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
            model: ScheduleShiftDetail,
            where: { schedule_type: 'defined_Schedules' },
            required: false,
            as: 'shift',
            include: {
              model: ScheduleShift
            }
          },
          {
            model: ScheduleNote,
            where: { schedule_type: 'defined_schedules' },
            required: false,
            as: 'notes'
          }
        ]
      });
      const responses = {
        id: submissionData.id,
        employee_id: submissionData.employee_id,
        full_name: submissionData.employee.user.full_name,
        date: submissionData.presence_date,
        branch: submissionData.company.company_name || submissionData.company.name,
        avatar: submissionData.employee.assets.length
          ? submissionData.employee.assets[0].url
          : null,
        shift_name: submissionData.shift.schedule_shift.shift_name,
        start_time: submissionData.shift.schedule_shift.start_time,
        end_time: submissionData.shift.schedule_shift.end_time,
        note: submissionData.notes
          ? {
              id: submissionData.notes.id,
              note: submissionData.notes.note
            }
          : null,
        status: submissionData.status
      };

      return this.res
        .status(200)
        .json(response(true, 'Data pengajuan jadwal berhasil didapatkan', responses));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }

  async patchSubmissionApproval() {
    const { status } = this.req.query;
    const { data } = this.req.body;
    const transaction = await sequelize.transaction();
    try {
      for (const item of data.schedules) {
        // handle approved submission
        if (status === 'approved') {
          if (!item.rev) {
            // get schedule
            const schedule = await DefinedSchedule.findOne({ where: { id: item.id } });
            // submission is beri jadwal untuk diambil
            if (schedule.status === 1) {
              const updateSchedule = await DefinedSchedule.update(
                { employee_id: null, status: 0 },
                { where: { id: item.id } },
                { transaction }
              );
              if (!updateSchedule) {
                await transaction.rollback();
                return this.res
                  .status(400)
                  .json(response(false, 'Gagal menyetujui pengajuan jadwal'));
              }
              const updateScheduleSubmission = await ScheduleSubmission.update(
                { status: 1 },
                { where: { defined_schedule_id: item.id, status: 0 } },
                { transaction }
              );
              if (!updateScheduleSubmission) {
                await transaction.rollback();
                return this.res
                  .status(400)
                  .json(response(false, 'Gagal menyetujui pengajuan jadwal'));
              }
              // send notification
              observe.emit(EVENT.GIVE_SCHEDULE_TO_TAKE_APPROVAL, {
                date: schedule.presence_date,
                employeeId: schedule.employee_id,
                status: 'approved'
              });
            }
            if (schedule.status === 2) {
              const updateSchedule = await DefinedSchedule.update(
                { status: 0 },
                { where: { id: item.id } },
                { transaction }
              );
              if (!updateSchedule) {
                await transaction.rollback();
                return this.res
                  .status(400)
                  .json(response(false, 'Gagal menyetujui pengajuan jadwal'));
              }
            }
          } else {
            // get schedule swap
            const scheduleSwap = await ScheduleSwap.findOne({
              where: { id: item.id },
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
            const selfData = scheduleSwap.schedule_swap_details.find(
              val => val.defined_schedule.status === 3
            );
            const awayData = scheduleSwap.schedule_swap_details.find(
              val => val.defined_schedule.status === 4
            );
            for (const swap of scheduleSwap.schedule_swap_details) {
              const updateDefinedSchedule = await DefinedSchedule.update(
                {
                  employee_id:
                    swap.defined_schedule.status === 3
                      ? awayData.defined_schedule.employee_id
                      : selfData.defined_schedule.employee_id,
                  status: 0
                },
                { where: { id: swap.defined_schedule.id } },
                { transaction }
              );
              if (!updateDefinedSchedule) {
                await transaction.rollback();
                return this.res
                  .status(400)
                  .json(response(false, 'Gagal menyetujui pengajuan jadwal'));
              }
            }
            // set schedule swap to complete
            const updateScheduleSwap = await ScheduleSwap.update(
              { status: 2 },
              { where: { id: item.id } },
              { transaction }
            );
            if (!updateScheduleSwap) {
              await transaction.rollback();
              return this.res
                .status(400)
                .json(response(false, 'Gagal menyetujui pengajuan jadwal'));
            }
            // send notification
            let applicant;
            let respondent;
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
            observe.emit(EVENT.SCHEDULE_SWAP_APPROVAL, {
              applicant,
              respondent,
              type: 'approved',
              employeeIds: [applicant.employeeId, respondent.employeeId]
            });
          }
        }

        // handle rejected submission
        if (status === 'rejected') {
          if (!item.rev) {
            // get schedule
            const schedule = await DefinedSchedule.findOne({ where: { id: item.id } });
            if (schedule.status === 1) {
              const updateSchedule = await DefinedSchedule.update(
                { status: 0 },
                { where: { id: item.id } },
                { transaction }
              );
              if (!updateSchedule) {
                await transaction.rollback();
                return this.res.status(400).json(response(false, 'Gagal menolak pengajuan jadwal'));
              }
              const updateScheduleSubmission = await ScheduleSubmission.update(
                { status: -1 },
                { where: { defined_schedule_id: item.id, status: 0 } },
                { transaction }
              );
              if (!updateScheduleSubmission) {
                await transaction.rollback();
                return this.res
                  .status(400)
                  .json(response(false, 'Gagal menyetujui pengajuan jadwal'));
              }
              // send notification
              observe.emit(EVENT.GIVE_SCHEDULE_TO_TAKE_APPROVAL, {
                date: schedule.presence_date,
                employeeId: schedule.employee_id,
                status: 'rejected'
              });
            } else if (schedule.status === 2) {
              const updateSchedule = await DefinedSchedule.update(
                { status: 0, employee_id: null },
                { where: { id: item.id } },
                { transaction }
              );
              if (!updateSchedule) {
                await transaction.rollback();
                return this.res.status(400).json(response(false, 'Gagal menolak pengajuan jadwal'));
              }
            }
          } else {
            const scheduleSwap = await ScheduleSwap.findOne({
              where: { id: item.id },
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
                return this.res.status(400).json(response(false, 'Gagal menolak pengajuan jadwal'));
              }
            }
            // set schedule swap to complete
            const updateScheduleSwap = await ScheduleSwap.update(
              { status: -1 },
              { where: { id: item.id } },
              { transaction }
            );
            if (!updateScheduleSwap) {
              await transaction.rollback();
              return this.res.status(400).json(response(false, 'Gagal menolak pengajuan jadwal'));
            }
            // send notification
            let applicant;
            let respondent;
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
            observe.emit(EVENT.SCHEDULE_SWAP_APPROVAL, {
              applicant,
              respondent,
              type: 'rejected',
              employeeIds: [applicant.employeeId, respondent.employeeId]
            });
          }
        }
      }
      await transaction.commit();
      return this.res
        .status(200)
        .json(
          response(
            true,
            `Pengajuan jadwal berhasil di${status === 'approved' ? 'terima' : 'tolak'}`
          )
        );
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }

  async patchAbortSubmission() {
    const { schedule_id: scheduleId } = this.req.params;
    try {
      const schedule = await DefinedSchedule.findOne({ where: { id: scheduleId } });
      if (!schedule) {
        return this.res.status(400).json(response(false, 'Data pengajuan tidak ditemukan'));
      }
      let updatePayload = {
        status: 0
      };
      if (schedule.status === 2) {
        updatePayload = {
          status: 0,
          employee_id: null
        };
      }

      const updateSchedule = await DefinedSchedule.update(updatePayload, {
        where: { id: scheduleId }
      });
      if (!updateSchedule) {
        return this.res.status(400).json(response(false, 'Gagal membatalkan pengajuan'));
      }
      return this.res.status(200).json(response(true, 'Pengajuan berhasil dibatalkan'));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
  async getHistory() {
    const { employeeId, employeeRole, companyParentId } = this.res.local.users;
    try {
      let employeeIds = [];
      const employee = await Employee.findOne({
        where: { id: employeeId },
        attributes: ['company_id']
      });
      if (employeeRole == 1) {
        const employees = await Employee.findAll({
          where: { company_id: employee.company_id, role: { [Op.ne]: 1 } },
          attributes: ['id']
        });
        employeeIds = employees.map(val => val.id);
      }
      const scheduleSubmissions = await ScheduleSubmission.findAll({
        where: {
          employee_id: employeeRole === 1 ? employeeIds : employeeId,
          status: { [Op.ne]: 0 }
        },
        include: [
          {
            model: Employee,
            attributes: ['id'],
            required: true,
            include: [
              {
                model: Company,
                where: { parent_company_id: companyParentId },
                required: true
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
            model: DefinedSchedule,
            include: {
              model: ScheduleShiftDetail,
              where: { schedule_type: 'defined_Schedules' },
              required: false,
              as: 'shift',
              include: {
                model: ScheduleShift
              }
            }
          }
        ]
      });
      const scheduleSwaps = await ScheduleSwap.findAll({
        where: { [Op.or]: [{ status: 2 }, { status: -1 }], company_id: employee.company_id },
        include: { model: Company, attributes: ['company_name', 'name'] }
      });
      for (const [index, value] of scheduleSwaps.entries()) {
        const employees = await Employee.findAll({
          where: { id: [value.self_id, value.away_id] },
          attributes: ['id'],
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
        });
        scheduleSwaps[index].dataValues.employee = employees;
      }

      const responses = [];
      for (const data of scheduleSubmissions) {
        responses.push({
          id: data.defined_schedule.id,
          full_name: data.employee.user.full_name,
          description: data.type === 1 ? 'Lempar Jadwal' : 'Menerima Jadwal',
          avatar: data.employee.assets.length ? data.employee.assets[0].url : null,
          start_time: data.defined_schedule.shift.schedule_shift.start_time,
          end_time: data.defined_schedule.shift.schedule_shift.end_time,
          branch: data.employee.company.company_name || data.employee.company.name,
          created_at: data.created_at,
          status: data.status
        });
      }
      for (const data of scheduleSwaps) {
        responses.push({
          id: data.id,
          full_name: data.dataValues.employee[0].user.full_name,
          description: 'Tukar jadwal',
          avatar: data.dataValues.employee[0].assets.length
            ? data.dataValues.employee[0].assets[0].url
            : null,
          away_avatar: data.dataValues.employee[1].assets.length
            ? data.dataValues.employee[1].assets[0].url
            : null,
          branch: data.company.company_name || data.company.name,
          created_at: data.created_at,
          status: data.status === 2 ? 1 : -1
        });
      }
      return this.res
        .status(200)
        .json(response(true, 'Data riwayat jadwal berhasil didapatkan', responses));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
}

module.exports = Submission;

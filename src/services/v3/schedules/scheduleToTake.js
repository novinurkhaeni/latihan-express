require('module-alias/register');
const { response } = require('@helpers');
const { Sequelize } = require('sequelize');
const { Op } = Sequelize;
const {
  sequelize,
  defined_schedules: DefinedSchedule,
  schedule_notes: ScheduleNote,
  schedule_shift_details: ScheduleShiftDetail,
  schedule_shifts: ScheduleShift,
  companies: Company,
  users: User,
  salary_groups: SalaryGroup
} = require('@models');
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

class ScheduleToTake {
  constructor(req, res) {
    this.req = req;
    this.res = res;
  }
  // Schedule to Take by Employee
  async postScheduleToTake() {
    const { data } = this.req.body;
    try {
      // initialize transaction
      let transaction = await sequelize.transaction();
      try {
        // Create Defined Schedule
        const createSchedule = await DefinedSchedule.create(
          { presence_date: data.date, company_id: data.company_id },
          { transaction }
        );
        if (!createSchedule) {
          await transaction.rollback();
          return this.res
            .status(400)
            .json(response(false, 'Pembuatan jadwal untuk diambil tidak berhasil'));
        }
        // Create Schedule Shift Detail
        const createShiftDetail = await ScheduleShiftDetail.create(
          {
            shift_id: data.shift_id,
            schedule_id: createSchedule.id,
            schedule_type: 'defined_schedules'
          },
          { transaction }
        );
        if (!createShiftDetail) {
          await transaction.rollback();
          return this.res
            .status(400)
            .json(response(false, 'Pembuatan jadwal untuk diambil tidak berhasil'));
        }
        // Create Schedule Note
        const createScheduleNote = await ScheduleNote.create(
          {
            schedule_id: createSchedule.id,
            schedule_type: 'defined_schedules',
            note: data.note
          },
          { transaction }
        );
        if (!createScheduleNote) {
          await transaction.rollback();
          return this.res
            .status(400)
            .json(response(false, 'Pembuatan jadwal untuk diambil tidak berhasil'));
        }
        await transaction.commit();
        return this.res.status(201).json(response(true, 'Jadwal untuk diambil berhasil dibuat'));
      } catch (error) {
        await transaction.rollback();
        if (error.errors) {
          return this.res.status(400).json(response(false, error.errors));
        }
        return this.res.status(400).json(response(false, error.message));
      }
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }

  async getScheduleToTakeDetail() {
    const { schedule_id: scheduleId } = this.req.params;
    try {
      // Get Schedule Data
      const getSchedule = await DefinedSchedule.findOne({
        where: { id: scheduleId },
        include: [
          {
            model: ScheduleShiftDetail,
            where: { schedule_type: 'defined_Schedules' },
            required: false,
            as: 'shift',
            include: {
              model: ScheduleShift,
              include: {
                model: SalaryGroup,
                attributes: ['salary']
              }
            }
          },
          {
            model: ScheduleNote,
            required: false,
            where: { schedule_type: 'defined_schedules' },
            as: 'notes'
          },
          {
            model: Company,
            attributes: ['name', 'company_name']
          }
        ]
      });
      const compose = {
        id: getSchedule.id,
        date: getSchedule.presence_date,
        shift: {
          id: getSchedule.shift.schedule_shift.id,
          shift_name: getSchedule.shift.schedule_shift.shift_name,
          start_time: getSchedule.shift.schedule_shift.start_time,
          end_time: getSchedule.shift.schedule_shift.end_time
        },
        company_id: getSchedule.company_id,
        company_name: getSchedule.company.company_name || getSchedule.company.name,
        note: getSchedule.notes ? getSchedule.notes.note : null,
        salary: getSchedule.shift.schedule_shift.salary_group
          ? getSchedule.shift.schedule_shift.salary_group.salary
          : null
      };
      return this.res
        .status(200)
        .json(response(true, 'Jadwal untuk diambil berhasil dibuat', compose));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }

  async putScheduleToTake() {
    const { schedule_id: scheduleId } = this.req.params;
    const { data } = this.req.body;
    try {
      // initialize transaction
      const transaction = await sequelize.transaction();
      try {
        const editSchedule = await DefinedSchedule.update(
          { presence_date: data.date, company_id: data.company_id },
          { where: { id: scheduleId }, transaction }
        );
        if (!editSchedule) {
          await transaction.rollback();
          return this.res
            .status(400)
            .json(response(false, 'Gagal mengubah data jadwal untuk diambil'));
        }
        const editShift = await ScheduleShiftDetail.update(
          { shift_id: data.shift_id },
          { where: { schedule_id: scheduleId, schedule_type: 'defined_schedules' }, transaction }
        );
        if (!editShift) {
          await transaction.rollback();
          return this.res
            .status(400)
            .json(response(false, 'Gagal mengubah data jadwal untuk diambil'));
        }
        const editNote = await ScheduleNote.update(
          { note: data.note },
          { where: { schedule_id: scheduleId, schedule_type: 'defined_schedules' }, transaction }
        );
        if (!editNote) {
          await transaction.rollback();
          return this.res
            .status(400)
            .json(response(false, 'Gagal mengubah data jadwal untuk diambil'));
        }
        await transaction.commit();
        return this.res
          .status(200)
          .json(response(true, 'Behasil mengubah data jadwal untuk diambil'));
      } catch (error) {
        await transaction.rollback();
        if (error.errors) {
          return this.res.status(400).json(response(false, error.errors));
        }
        return this.res.status(400).json(response(false, error.message));
      }
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }

  async patchScheduleToTake() {
    const { data } = this.req.body;
    const { schedule_id: scheduleId } = this.req.params;
    const { companyParentId, id } = this.res.local.users;
    try {
      // Check is schedule already taken or not
      const checkSchedule = await DefinedSchedule.findOne({
        where: { id: scheduleId, employee_id: { [Op.ne]: null } }
      });
      if (checkSchedule) {
        return this.res.status(400).json(response(false, 'Jadwal sudah diambil'));
      }
      // Status 2 means ambil jadwal
      const updateSchdule = await DefinedSchedule.update(
        { status: 2, employee_id: data.employee_id },
        { where: { id: scheduleId } }
      );
      if (!updateSchdule) {
        return this.res.status(400).json(response(false, 'Gagal mengambil jadwal'));
      }
      // send notification
      const user = await User.findOne({ where: { id }, attributes: ['full_name'] });
      observe.emit(EVENT.SUBMISSION_CREATION, {
        parentCompanyId: companyParentId,
        message: {
          title: 'Pengajuan Ambil Jadwal',
          body: `${user.full_name} telah mengajukan ambil jadwal`
        },
        ability: 'SUBMISSION_SCHEDULE'
      });
      return this.res
        .status(200)
        .json(response(true, 'Jadwal berhasil diambil, menunggu respon pemilik usaha'));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
  // Schedule to Take by Owner
  async createScheduleToTake() {
    const { data } = this.req.body;
    const transaction = await sequelize.transaction();
    try {
      const shiftDetailPayload = [];
      const scheduleNotePayload = [];
      for (const schedule of data.schedules) {
        for (const shiftId of schedule.shift_ids) {
          const createSchedule = await DefinedSchedule.create(
            {
              company_id: data.company_id,
              presence_date: schedule.presence_date
            },
            { transaction }
          );
          if (!createSchedule) {
            await transaction.rollback();
            return this.res.status(400).json(response(false, 'Gagal membuat jadwal untuk diambil'));
          }
          shiftDetailPayload.push({
            shift_id: shiftId,
            schedule_id: createSchedule.id,
            schedule_type: 'defined_schedules'
          });
          scheduleNotePayload.push({
            schedule_id: createSchedule.id,
            schedule_type: 'defined_schedules',
            note: data.note
          });
        }
      }
      //  Create Schedule Shift Detail
      const createScheduleShiftDetail = await ScheduleShiftDetail.bulkCreate(shiftDetailPayload);
      if (!createScheduleShiftDetail) {
        await transaction.rollback();
        return this.res.status(400).json(response(false, 'Gagal membuat jadwal untuk diambil'));
      }
      // Create Schedule Note
      const createScheduleNote = await ScheduleNote.bulkCreate(scheduleNotePayload);
      if (!createScheduleNote) {
        await transaction.rollback();
        return this.res.status(400).json(response(false, 'Gagal membuat jadwal untuk diambil'));
      }
      await transaction.commit();
      return this.res.status(201).json(response(false, 'Berhasil membuat jadwal untuk diambil'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
}

module.exports = ScheduleToTake;

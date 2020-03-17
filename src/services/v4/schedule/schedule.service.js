require('module-alias/register');
const { response, dateConverter } = require('@helpers');
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const {
  sequelize,
  defined_schedules: DefinedSchedules,
  journals: Journal,
  employees: Employee,
  employee_notes: EmployeeNote,
  users: User,
  presences: Presence,
  schedule_notes: ScheduleNotes,
  schedule_shift_details: ScheduleShiftDetails,
  schedule_shifts: ScheduleShifts,
  schedule_templates: ScheduleTemplates
} = require('@models');

const Schedule = {
  patchSchedule: async (req, res) => {
    const { schedule_id: scheduleId } = req.params;
    const { type } = req.query;
    const { data } = req.body;
    const transaction = await sequelize.transaction();
    try {
      if (type === 'defined') {
        const checkSchedule = await DefinedSchedules.findOne({
          where: { id: scheduleId }
        });
        if (!checkSchedule) {
          return res.status(400).json(response(false, 'Jadwal tidak ditemukan'));
        }
      } else if (type === 'template') {
        const checkSchedule = await ScheduleTemplates.findOne({
          where: { id: scheduleId }
        });
        if (!checkSchedule) {
          return res.status(400).json(response(false, 'Jadwal tidak ditemukan'));
        }
      }
      const checkShift = await ScheduleShifts.findOne({
        where: { id: data.shift_id }
      });
      if (!checkShift) {
        return res.status(400).json(response(false, 'Shift tidak ditemukan'));
      }
      const checkNote = await ScheduleNotes.findOne({
        where: { id: data.note.id }
      });
      if (!checkNote) {
        return res.status(400).json(response(false, 'Note tidak ditemukan'));
      }
      const editShift = await ScheduleShiftDetails.update(
        { shift_id: data.shift_id },
        { where: { schedule_id: scheduleId }, transaction }
      );
      if (!editShift) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal mengubah shift'));
      }
      const editNote = await ScheduleNotes.update(
        { note: data.note.text },
        { where: { id: data.note.id }, transaction }
      );
      if (!editNote) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal mengubah note'));
      }
      await transaction.commit();
      return res.status(200).json(response(true, 'Jadwal berhasil diubah'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }

      return res.status(400).json(response(false, error.message));
    }
  },

  deleteSchedule: async (req, res) => {
    const { data } = req.body;
    const { mode } = req.query;

    const today = dateConverter(new Date());

    const transaction = await sequelize.transaction();
    try {
      for (const schedule of data.schedules) {
        if (schedule.type === 'once' && mode === 'today') {
          const deleteSchedule = await DefinedSchedules.destroy(
            {
              where: { id: schedule.schedule_id }
            },
            { transaction }
          );
          if (!deleteSchedule) {
            await transaction.rollback();
            return res.status(400).json(response(false, 'Gagal menghapus jadwal'));
          }
        }
        if (schedule.type === 'once' && mode === 'upcoming') {
          let employeeId = await DefinedSchedules.findAll({
            where: { id: schedule.schedule_id },
            attributes: ['employee_id']
          });
          if (!employeeId.length) {
            return res.status(400).json(response(false, 'Id karyawan tidak ditemukan'));
          }
          const employeeIds = [];
          employeeId.forEach(val => {
            employeeIds.push(val.employee_id.toString());
          });
          const deleteSchedule = await DefinedSchedules.destroy(
            {
              where: {
                employee_id: employeeIds,
                presence_date: { [Op.gte]: data.date }
              }
            },
            { transaction }
          );
          if (!deleteSchedule) {
            await transaction.rollback();
            return res.status(400).json(response(false, 'Gagal menghapus jadwal'));
          }
        }
        if (schedule.type === 'continous' && mode === 'today') {
          const scheduleTemplate = await ScheduleTemplates.findOne({
            where: { id: schedule.schedule_id },
            attributes: ['deleted_date']
          });
          if (!scheduleTemplate) {
            await transaction.rollback();
            return res.status(400).json(response(false, 'Jadwal tidak ditemukan'));
          }
          let deletedDate = scheduleTemplate.deleted_date;
          if (deletedDate) {
            deletedDate = deletedDate.concat(`,${data.date}`);
          } else {
            deletedDate = data.date;
          }
          const updateScheduleTemplate = await ScheduleTemplates.update(
            { deleted_date: deletedDate },
            { where: { id: schedule.schedule_id } },
            { transaction }
          );
          if (!updateScheduleTemplate) {
            await transaction.rollback();
            return res.status(400).json(response(false, 'Gagal menghapus jadwal'));
          }
        }
        if (schedule.type === 'continous' && mode === 'upcoming') {
          const scheduleTemplate = await ScheduleTemplates.findOne({
            where: { id: schedule.schedule_id },
            attributes: ['start_date']
          });
          if (!scheduleTemplate) {
            await transaction.rollback();
            return res.status(400).json(response(false, 'Jadwal tidak ditemukan'));
          }
          let employeeId = await ScheduleTemplates.findAll({
            where: { id: schedule.schedule_id },
            attributes: ['employee_id']
          });
          if (!employeeId.length) {
            return res.status(400).json(response(false, 'Id karyawan tidak ditemukan'));
          }
          const employeeIds = [];
          employeeId.forEach(val => {
            employeeIds.push(val.employee_id.toString());
          });
          // Find All Grouped Schedule Template by Created At
          const scheduleTemplates = await ScheduleTemplates.findAll({
            where: {
              start_date: { [Op.gte]: scheduleTemplate.start_date },
              employee_id: employeeIds
            }
          });
          for (const scheduleTemplate of scheduleTemplates) {
            const updateScheduleTemplate = await ScheduleTemplates.update(
              { deleted_after: data.date },
              { where: { id: scheduleTemplate.id } },
              { transaction }
            );
            if (!updateScheduleTemplate) {
              await transaction.rollback();
              return res.status(400).json(response(false, 'Gagal menghapus jadwal'));
            }
          }
        }
        if (schedule.presence_id !== null) {
          let presenceModel = await Presence.findAll({
            where: { id: schedule.presence_id },
            include: { model: Employee, include: { model: User, attributes: ['full_name'] } }
          });
          if (!presenceModel.length) {
            return res.status(400).json(response(false, 'Data presensi tidak ditemukan'));
          }
          const employeeIds = [];
          let memberNames = [];
          const presenceDate = presenceModel[0].presence_date;
          if (today > presenceDate) {
            return res
              .status(400)
              .json(response(false, 'Tidak bisa menghapus kehadiran yang telah berlalu'));
          }
          presenceModel.forEach(val => {
            employeeIds.push(val.employee_id.toString());
            memberNames.push(val.employee.user.full_name);
          });
          memberNames = memberNames.toString().replace(/,/g, ', ');
          await Journal.destroy(
            {
              where: [
                Sequelize.where(
                  Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
                  mode === undefined || mode === 'today' ? '=' : '>=',
                  presenceDate
                ),
                {
                  employee_id: employeeIds,
                  type: { [Op.notIn]: ['withdraw', 'subscribe', 'payment'] }
                }
              ]
            },
            { transaction }
          );
          if (mode === undefined || mode === 'today') {
            await EmployeeNote.destroy(
              { where: { employee_id: employeeIds, date: presenceDate } },
              { transaction }
            );
            const deletePresence = await Presence.destroy(
              {
                where: { employee_id: employeeIds, id: schedule.presence_id },
                cascade: true
              },
              { transaction }
            );
            if (!deletePresence) {
              await transaction.rollback();
              return res.status(400).json(response(false), 'Tidak ada presensi yang terhapus');
            }
          } else {
            await EmployeeNote.destroy(
              {
                where: { employee_id: employeeIds, date: { [Op.gte]: presenceDate } }
              },
              { transaction }
            );
            const deletePresence = await Presence.destroy(
              {
                where: { employee_id: employeeIds, presence_date: { [Op.gte]: presenceDate } },
                cascade: true
              },
              { transaction }
            );
            if (!deletePresence) {
              await transaction.rollback();
              return res.status(400).json(response(false), 'Tidak ada presensi yang terhapus');
            }
          }
        }
      }
      await transaction.commit();
      return res.status(200).json(response(true, 'Berhasil menghapus data'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }

      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = Schedule;

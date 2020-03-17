require('module-alias/register');
const {
  Sequelize: { Op }
} = require('sequelize');
const { response, dateConverter } = require('@helpers');
const {
  sequelize,
  schedule_templates: ScheduleTemplate,
  defined_schedules: DefinedSchedule,
  schedule_shift_details: ScheduleShiftDetail,
  employees: Employee,
  users: User
} = require('@models');

const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

class Schedule {
  constructor(req, res) {
    this.req = req;
    this.res = res;
  }

  async createScheduleContinous() {
    const {
      body: { data }
    } = this.req;
    const { employeeId } = this.res.local.users;
    let schedulePayload;
    let memberNames = [];
    const transaction = await sequelize.transaction();
    try {
      // Loop for Schedules Data
      for (const schedule of data.schedules) {
        // Loop for Members Data
        for (const member of data.members) {
          // Loop for Shifts Data
          for (const shift of schedule.shift_ids) {
            // Compose Payload
            if (data.repeat_type === 'Monthly') {
              schedulePayload = {
                employee_id: member,
                company_id: data.company_id,
                start_date: schedule.start_date,
                end_date: schedule.end_date,
                repeat_type: data.repeat_type,
                monthly_frequent: data.monthly_frequent,
                monthly_frequent_date: new Date(schedule.start_date).getDate()
              };
            }
            if (data.repeat_type === 'Weekly') {
              const date = new Date(data.start_date);
              const dayInWeek = date.getDay();
              const dateInMonth = date.getDate();
              const useDate = new Date(
                date.setDate(
                  parseInt(dateInMonth) -
                    parseInt(dayInWeek) +
                    parseInt(schedule.weekly_frequent_days)
                )
              );
              schedulePayload = {
                employee_id: member,
                company_id: data.company_id,
                start_date: dateConverter(useDate),
                end_date: dateConverter(useDate),
                repeat_type: data.repeat_type,
                weekly_frequent: data.weekly_frequent,
                weekly_frequent_days: schedule.weekly_frequent_days + 1
              };
            }
            const createSchedule = await ScheduleTemplate.create(schedulePayload, {
              transaction
            });
            if (!createSchedule) {
              await transaction.rollback();
              return this.res.status(400).json(response(false, 'Gagal membuat jadwal'));
            }
            // Compose Schedule Shift Detail
            const shiftDetailPayload = {
              shift_id: shift,
              schedule_id: createSchedule.id,
              schedule_type: 'schedule_templates'
            };
            // Insert Schedule Shift Detail
            const createShiftDetail = await ScheduleShiftDetail.create(shiftDetailPayload, {
              transaction
            });
            if (!createShiftDetail) {
              await transaction.rollback();
              return this.res.status(400).json(response(false, 'Gagal membuat jadwal'));
            }
          }
          const getMemberName = await Employee.findOne({
            where: { id: member },
            include: { model: User, attributes: ['full_name'] }
          });
          memberNames.push(getMemberName.user.full_name);
        }
      }
      // Notification Thing
      const getCurrentUser = await Employee.findOne({
        where: { id: employeeId },
        include: [{ model: User, attributes: ['full_name'] }]
      });
      // COMPOSE DESCRIPTION FOR NOTIFICATION
      const names = memberNames
        .toString()
        .split(',')
        .join(', ');
      const description = `${getCurrentUser.user.full_name} telah membuat jadwal untuk ${names}`;
      // SEND NOTIFICATION TO MANAGERS
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      await transaction.commit();
      return this.res.status(201).json(response(true, 'Jadwal berhasil dibuat'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }

  async createScheduleOnce() {
    const {
      body: { data },
      query: { type }
    } = this.req;
    const { employeeId } = this.res.local.users;
    let schedulePayload;
    let memberNames = [];
    const transaction = await sequelize.transaction();

    try {
      // Loop for Schedules Data
      for (const schedule of data.schedules) {
        // Loop for Members Data
        for (const member of data.members) {
          // Loop for Shifts Data
          for (const shift of schedule.shift_ids) {
            if (type === 'monthly') {
              // Compose Schedule Payload
              schedulePayload = {
                employee_id: member,
                company_id: data.company_id,
                presence_date: schedule.presence_date
              };
            } else if (type === 'weekly') {
              const startDate = new Date(data.start_date);
              const selectedDay = startDate.getDay();
              let finalDate;
              if (selectedDay > schedule.day) {
                const nextWeek = new Date(
                  startDate.setDate(startDate.getDate() + (selectedDay + 1))
                );
                finalDate = nextWeek.setDate(nextWeek.getDate() + schedule.day);
              } else {
                const startWeek = new Date(startDate.setDate(startDate.getDate() - selectedDay));
                finalDate = startWeek.setDate(startWeek.getDate() + schedule.day);
              }
              schedulePayload = {
                employee_id: member,
                company_id: data.company_id,
                presence_date: dateConverter(finalDate)
              };
            }
            // Create Schedule
            const createSchedule = await DefinedSchedule.create(schedulePayload, {
              transaction
            });
            if (!createSchedule) {
              await transaction.rollback();
              return this.res.status(400).json(response(false, 'Gagal membuat jadwal'));
            }
            // Compose Schedule Shift Detail
            const shiftDetailPayload = {
              shift_id: shift,
              schedule_id: createSchedule.id,
              schedule_type: 'defined_schedules'
            };
            // Insert Schedule Shift Detail
            const createShiftDetail = await ScheduleShiftDetail.create(shiftDetailPayload, {
              transaction
            });
            if (!createShiftDetail) {
              await transaction.rollback();
              return this.res.status(400).json(response(false, 'Gagal membuat jadwal'));
            }
            const getMemberName = await Employee.findOne({
              where: { id: member },
              include: { model: User, attributes: ['full_name'] }
            });
            memberNames.push(getMemberName.user.full_name);
          }
        }
      }
      // Notification Thing
      const getCurrentUser = await Employee.findOne({
        where: { id: employeeId },
        include: [{ model: User, attributes: ['full_name'] }]
      });
      // COMPOSE DESCRIPTION FOR NOTIFICATION
      const names = memberNames
        .toString()
        .split(',')
        .join(', ');
      const description = `${getCurrentUser.user.full_name} telah membuat jadwal untuk ${names}`;
      // SEND NOTIFICATION TO MANAGERS
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      await transaction.commit();
      return this.res.status(201).json(response(true, 'Jadwal berhasil dibuat'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }

  async deleteSchedule() {
    const { data } = this.req.body;
    const { mode } = this.req.query;
    const transaction = await sequelize.transaction();
    try {
      for (const schedule of data.schedules) {
        if (schedule.type === 'once' && mode === 'today') {
          const deleteSchedule = await DefinedSchedule.destroy(
            {
              where: { id: schedule.schedule_id }
            },
            { transaction }
          );
          if (!deleteSchedule) {
            await transaction.rollback();
            return this.res.status(400).json(response(false, 'Gagal menghapus jadwal'));
          }
        }
        if (schedule.type === 'once' && mode === 'upcoming') {
          // Delete Schedule Record from Defined Schedules Table
          const deleteSchedule = await DefinedSchedule.destroy(
            {
              where: {
                employee_id: schedule.employee_id,
                presence_date: { [Op.gte]: data.date }
              }
            },
            { transaction }
          );
          if (!deleteSchedule) {
            await transaction.rollback();
            return this.res.status(400).json(response(false, 'Gagal menghapus jadwal'));
          }
        }
        if (schedule.type === 'continous' && mode === 'today') {
          const scheduleTemplate = await ScheduleTemplate.findOne({
            where: { id: schedule.schedule_id },
            attributes: ['deleted_date']
          });
          if (!scheduleTemplate) {
            await transaction.rollback();
            return this.res.status(400).json(response(false, 'Jadwal tidak ditemukan'));
          }

          let deletedDate = scheduleTemplate.deleted_date;
          if (deletedDate) {
            deletedDate = deletedDate.concat(`,${data.date}`);
          } else {
            deletedDate = data.date;
          }

          const updateScheduleTemplate = await ScheduleTemplate.update(
            { deleted_date: deletedDate },
            { where: { id: schedule.schedule_id } },
            { transaction }
          );
          if (!updateScheduleTemplate) {
            await transaction.rollback();
            return this.res.status(400).json(response(false, 'Gagal menghapus jadwal'));
          }
        }
        if (schedule.type === 'continous' && mode === 'upcoming') {
          const scheduleTemplate = await ScheduleTemplate.findOne({
            where: { id: schedule.schedule_id },
            attributes: ['start_date']
          });
          if (!scheduleTemplate) {
            await transaction.rollback();
            return this.res.status(400).json(response(false, 'Jadwal tidak ditemukan'));
          }
          // Find All Grouped Schedule Template by Created At
          const scheduleTemplates = await ScheduleTemplate.findAll({
            where: {
              start_date: { [Op.gte]: scheduleTemplate.start_date },
              employee_id: schedule.employee_id
            }
          });
          for (const scheduleTemplate of scheduleTemplates) {
            const updateScheduleTemplate = await ScheduleTemplate.update(
              { deleted_after: data.date },
              { where: { id: scheduleTemplate.id } },
              { transaction }
            );
            if (!updateScheduleTemplate) {
              await transaction.rollback();
              return this.res.status(400).json(response(false, 'Gagal menghapus jadwal'));
            }
          }
        }
      }
      return this.res.status(200).json(response(true, 'Berhasil menghapus jadwal'));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
}

module.exports = Schedule;

const { presences: Presence, employees: Employee } = require('@models');
const {
  definedSchedules: definedScheduleHelper,
  scheduleTemplates: scheduleTemplateHelper,
  dateConverter
} = require('@helpers');

const EVENT = require('../constants');

class CronPresence {
  constructor(observable) {
    this.observable = observable;
  }

  listenCronPresence() {
    this.observable.addListener(EVENT.CRON_PRESENCE, async () => {
      let backDate = new Date(`${new Date(new Date().setDate(new Date().getDate() - 1))} -0700`);
      backDate = dateConverter(backDate);
      // Get All Employees Data
      const employees = await Employee.findAll({
        attributes: ['id', 'company_id'],
        where: { active: 1 }
      });
      const employeeIds = employees.map(val => val.id);
      // Get All Schedule Data
      const definedSchedule = await definedScheduleHelper(backDate, null, employeeIds);
      const scheduleTemplate = await scheduleTemplateHelper(backDate, employeeIds);
      let schedules = definedSchedule.concat(scheduleTemplate);
      const scheduleEmployeeIds = schedules.map(val => val.employee.id);
      // Get All Presence Data
      const presences = await Presence.findAll({
        where: { employee_id: employeeIds, presence_date: backDate }
      });
      const presenceEmployeeIds = presences.map(val => val.employee_id);

      const presencePayload = [];
      for (const employeeId of scheduleEmployeeIds) {
        const findEmployeeId = presenceEmployeeIds.find(val => val == employeeId);
        if (!findEmployeeId) {
          presencePayload.push({
            employee_id: employeeId,
            company_id: employees.find(val => val.id == employeeId).company_id,
            presence_date: backDate,
            is_absence: 1
          });
        }
      }
      await Presence.bulkCreate(presencePayload);
    });
  }
}

module.exports = CronPresence;

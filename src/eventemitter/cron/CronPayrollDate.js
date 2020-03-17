const {
  companies: Companies,
  company_settings: CompanySetting,
  cron_payroll_dates: CronPayrollDates,
  employees: Employees,
  notifications: Notif
} = require('@models');
const { oneSignalApi } = require('@helpers');
const EVENT = require('../constants');

class CronPayrollDate {
  constructor(observable) {
    this.observable = observable;
  }
  listenCronPayrollDate() {
    this.observable.addListener(EVENT.CRON_PAYROLL_DATE, async () => {
      let date = new Date();
      date = new Date(`${date} -0700`).getDate();
      const cronCandidates = await CronPayrollDates.findAll({
        include: {
          model: Companies,
          required: true,
          include: [
            { model: CompanySetting, as: 'setting', where: { payroll_date: date } },
            { model: Employees, where: { role: 1 } }
          ]
        }
      });
      let companyIds = [];
      cronCandidates.forEach(data => {
        companyIds.push(data.company_id);
      });
      const collectOldData = await CompanySetting.findAll({
        where: { company_id: companyIds }
      });
      let notification = [];
      for (const data of cronCandidates) {
        const oldPayrollDate = collectOldData.filter(val => val.company_id === data.company_id);
        await CompanySetting.update(
          { payroll_date: data.payroll_date },
          { where: { company_id: data.company_id } }
        );
        await CronPayrollDates.destroy({ where: { id: data.id } });
        let employeeIds = [];
        data.company.employees.forEach(val => {
          employeeIds.push(val.id);
        });
        const compose = {
          employeeId: employeeIds,
          message: `Tanggal masuk kerja telah berubah dari tanggal ${oldPayrollDate[0].payroll_date} menjadi ${data.payroll_date}`
        };
        notification.push(compose);
      }
      // Send Notification to Eligible Companies Managers
      const HEADING_MESSAGE = 'Pergantian Tanggal Mulai Kerja';
      for (const data of notification) {
        let payloadNotif = [];
        let filters = [];
        /* eslint-disable quotes */
        data.employeeId.forEach(id => {
          payloadNotif.push({
            employee_id: id,
            body: data.message
          });
          filters.push(
            { field: 'tag', key: 'employeeId', relation: '=', value: id },
            { operator: 'OR' }
          );
        });
        filters.splice(-1, 1);
        if (process.env.NODE_ENV !== 'production') {
          // prettier-ignore
          /* eslint-disable quotes */
          filters.push(
            {"operator": "AND"},
            {"field": "tag", "key": "env", "relation": "=", "value": "development"}
          );
        }
        await Notif.bulkCreate(payloadNotif);
        /* eslint-disable quotes */
        const payload = {
          filters: filters,
          headings: { en: HEADING_MESSAGE },
          contents: { en: data.message }
        };

        const payloadAndroid = { ...payload, app_id: process.env.ANDROID_ONESIGNAL_APPID };
        const payloadIOS = { ...payload, app_id: process.env.IOS_ONESIGNAL_APPID };

        oneSignalApi.post('/notifications', payloadAndroid, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${process.env.ANDROID_ONESIGNAL_APIKEY}`
          }
        });

        oneSignalApi.post('/notifications', payloadIOS, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${process.env.IOS_ONESIGNAL_APIKEY}`
          }
        });
      }
    });
  }
}

module.exports = CronPayrollDate;

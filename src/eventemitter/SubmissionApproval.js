require('dotenv').config();
const { oneSignalApi } = require('@helpers');
const { notifications: Notif, employees: Employee } = require('@models');
const EVENT = require('./constants');

class SubmissionApproval {
  constructor(observable) {
    this.observable = observable;
  }

  listenSubmissionApproval() {
    this.observable.addListener(EVENT.SUBMISSION_APPROVAL, async data => {
      let filters = [];
      const notifPayload = [];

      // Find Owner
      const employee = await Employee.findOne({ where: { id: data.employeeId } });
      const owner = await Employee.findAll({ where: { company_id: employee.company_id, role: 1 } });
      const employeeIds = owner.map(val => val.id);
      employeeIds.push(data.employeeId);

      for (const employeeId of employeeIds) {
        notifPayload.push({ employee_id: employeeId, body: data.description });
        filters.push(
          { field: 'tag', key: 'employeeId', relation: '=', value: employeeId },
          { operator: 'OR' }
        );
      }
      filters.splice(-1, 1);
      await Notif.bulkCreate(notifPayload);

      if (process.env.NODE_ENV !== 'production') {
        // prettier-ignore
        /* eslint-disable quotes */
        filters.push(
          {"operator": "AND"},
          {"field": "tag", "key": "env", "relation": "=", "value": "development"}
        );
      }
      const payload = {
        filters: filters,
        headings: { en: data.title },
        contents: { en: data.description }
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
    });
  }
}

module.exports = SubmissionApproval;

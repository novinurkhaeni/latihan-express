require('dotenv').config();
const { oneSignalApi } = require('@helpers');
const { notifications: Notif, employees: Employee } = require('@models');
const EVENT = require('./constants');

class SubmissionAbort {
  constructor(observable) {
    this.observable = observable;
  }

  listenSubmissionAbort() {
    this.observable.addListener(EVENT.SUBMISSION_ABORT, async data => {
      const filters = [];
      const employeeIds = [];
      const messages = [];

      const managers = await Employee.findAll({ where: { company_id: data.companyId, role: 1 } });
      for (const manager of managers) {
        employeeIds.push(manager.id);
      }
      // PUSH MEMBER ID
      employeeIds.push(data.employeeId);
      // COMPOSE PAYLOAD FOR DATABASE AND SET FILTER FOR NOTIFICATION
      for (const employeeId of employeeIds) {
        messages.push({ employee_id: employeeId, body: data.description });
        filters.push(
          { field: 'tag', key: 'employeeId', relation: '=', value: employeeId },
          { operator: 'OR' }
        );
      }
      filters.splice(-1, 1);
      // STORE MESSAGES TO DATABASE
      await Notif.bulkCreate(messages);
      // PUSH FILTER FOR NOTIFICATION IN DEVELOPMENT ENV
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

module.exports = SubmissionAbort;

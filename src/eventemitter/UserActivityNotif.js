require('dotenv').config();
const {
  Sequelize: { Op }
} = require('sequelize');
const { oneSignalApi } = require('@helpers');
const {
  notifications: Notif,
  employees: Employee,
  companies: Company,
  logs: Log,
  notification_creators: NotificationCreator
} = require('@models');
const EVENT = require('./constants');

class UserActivityNotif {
  constructor(observable) {
    this.observable = observable;
  }

  listenUserActivityNotif() {
    this.observable.addListener(EVENT.USER_ACTIVITY_NOTIF, async data => {
      // Find All Manager of Current Company
      let payloadNotif = [];
      let payloadNotifCreator = [];
      let filters = [];
      const currentUser = await Employee.findOne({
        where: { id: data.employeeId },
        attributes: ['role'],
        include: { model: Company, attributes: ['id', 'company_name', 'name'] }
      });
      // Find Eligible User to Receive Notfication
      const eligibleUser = await Employee.findAll({
        attributes: ['id'],
        where: {
          company_id: currentUser.company.id,
          active: 1,
          id: { [Op.ne]: data.employeeId },
          [Op.or]: [{ role: 1 }, { role: 3 }, { role: 5 }, { role: 2 }]
        }
      });
      // CREATE RECORD TO LOGS
      await Log.create({
        platform: 'app',
        company: currentUser.company.company_name || currentUser.company.name,
        description: data.description
      });
      // Only Send Activity Notitification From Supervisor or Operator
      eligibleUser.forEach(val => {
        payloadNotif.push({ employee_id: val.id, body: data.description, is_read: 0 });
        filters.push(
          { field: 'tag', key: 'employeeId', relation: '=', value: val.id },
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
      // CREATE RECORD TO NOTIFICATION
      const createNotif = await Notif.bulkCreate(payloadNotif);
      createNotif.map(val =>
        payloadNotifCreator.push({ employee_id: data.employeeId, notification_id: val.id })
      );
      await NotificationCreator.bulkCreate(payloadNotifCreator);
      /* eslint-disable quotes */
      const payload = {
        filters: filters,
        headings: { en: 'Informasi' },
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

module.exports = UserActivityNotif;

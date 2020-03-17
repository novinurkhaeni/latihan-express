const { oneSignalApi } = require('@helpers');
const {
  notifications: Notif,
  employees: Employee,
  users: User,
  notification_creators: NotificationCreator
} = require('@models');
const EVENT = require('./constants');

class MemberLatePresence {
  constructor(observable) {
    this.observable = observable;
  }

  listenMemberLate() {
    this.observable.addListener(EVENT.MEMBER_LATE_PRESENCE, async data => {
      const employeeData = await Employee.findOne({
        where: { user_id: data.userId },
        attributes: ['role', 'id'],
        include: [
          {
            model: User,
            attributes: ['full_name']
          }
        ]
      });

      const managerData = await Employee.findAll({
        where: { company_id: data.companyId, role: '1' }
      });
      const HEADING_MESSAGE = `${employeeData.user.full_name} terlambat masuk tanggal ${data.presenceDate}`;
      const BODY_MESSAGE = `${employeeData.user.full_name} terlambat masuk ${data.presenceOverdue} menit di tanggal ${data.presenceDate}`;

      let filters = [];
      let payloadNotif = [];
      let payloadNotifCreator = [];
      for (let i = 0; i < managerData.length; i++) {
        payloadNotif.push({
          employee_id: managerData[i].id,
          body: BODY_MESSAGE
        });
        // prettier-ignore
        /* eslint-disable quotes */
        filters.push({"field": "tag", "key": "employeeId", "relation": "=", "value": managerData[i].id}, {"operator": "OR"});
      }
      filters.splice(-1, 1);
      if (process.env.NODE_ENV !== 'production') {
        // prettier-ignore
        /* eslint-disable quotes */
        filters.push(
          {"operator": "AND"},
          {"field": "tag", "key": "env", "relation": "=", "value": "development"}
        );
      }

      const createNotif = await Notif.bulkCreate(payloadNotif);
      createNotif.map(val =>
        payloadNotifCreator.push({ employee_id: employeeData.id, notification_id: val.id })
      );
      await NotificationCreator.bulkCreate(payloadNotifCreator);

      // prettier-ignore
      /* eslint-disable quotes */
      const payload = {
        "filters": filters,
        "headings": {"en": HEADING_MESSAGE},
        "contents": {"en": BODY_MESSAGE}
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

module.exports = MemberLatePresence;

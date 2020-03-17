const { oneSignalApi } = require('@helpers');
const { notifications: Notif, employees: Employee, users: User } = require('@models');
const EVENT = require('./constants');

class AskScheduleSwap {
  constructor(observable) {
    this.observable = observable;
  }

  listenAskScheduleSwap() {
    this.observable.addListener(EVENT.ASK_SCHEDULE_SWAP, async data => {
      // data.employeeIds[0] -> applicant, data.employeeIds[1] -> respondent
      const employees = await Employee.findAll({
        where: { id: data.employeeIds },
        include: { model: User }
      });
      /**
       * compose message
       */
      const message = {
        title: 'Permintaan Tukar Jadwal',
        body: `${employees[0].user.full_name} ingin menukarkan jadwalnya dengan milik anda yang ada di tanggal ${data.targetDate} `
      };
      /**
       * store message
       */
      await Notif.create({ employee_id: data.employeeIds[1], body: message.body });
      /**
       * send notification
       */
      let filters = [];
      filters.push({ field: 'tag', key: 'employeeId', relation: '=', value: data.employeeIds[1] });
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
        headings: { en: message.title },
        contents: { en: message.body }
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

module.exports = AskScheduleSwap;

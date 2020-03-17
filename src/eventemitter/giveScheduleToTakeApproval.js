const { oneSignalApi } = require('@helpers');
const { notifications: Notif } = require('@models');
const EVENT = require('./constants');

class GiveScheduleToTakeApproval {
  constructor(observable) {
    this.observable = observable;
  }

  listenGiveScheduleToTakeApproval() {
    this.observable.addListener(EVENT.GIVE_SCHEDULE_TO_TAKE_APPROVAL, async data => {
      let filters = [];
      /**
       * compose message
       */
      let message = {
        title: 'Pengajuan Beri Jadwal Untuk Diambil',
        body: `Pengajuan beri jadwal untuk diambil untuk tanggal ${data.date} telah ${
          data.status === 'approved' ? 'disetujui' : 'ditolak'
        }`
      };
      /**
       * store message
       */
      await Notif.create({ employee_id: data.employeeId, body: message.body });
      /**
       * send notification
       */
      filters.push({ field: 'tag', key: 'employeeId', relation: '=', value: data.employeeId });
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

module.exports = GiveScheduleToTakeApproval;

/* eslint-disable no-case-declarations */
/* eslint-disable indent */
const { oneSignalApi } = require('@helpers');
const { notifications: Notif } = require('@models');
const EVENT = require('./constants');

class ScheduleSwapApproval {
  constructor(observable) {
    this.observable = observable;
  }

  listenScheduleSwapApproval() {
    this.observable.addListener(EVENT.SCHEDULE_SWAP_APPROVAL, async data => {
      let message;
      let filters = [];
      /**
       * compose message
       */
      if (data.type === 'approved') {
        message = {
          title: 'Pengajuan Tukar Jadwal Disetujui',
          body: `Pengajuan tukar jadwal antara ${data.applicant.fullName} dengan ${data.respondent.fullName} telah disetujui`
        };
      }
      if (data.type === 'rejected') {
        message = {
          title: 'Pengajuan Tukar Jadwal Ditolak',
          body: `Pengajuan tukar jadwal antara ${data.applicant.fullName} dengan ${data.respondent.fullName} telah ditolak`
        };
      }
      /**
       * store message
       */
      const notifPayload = [];
      for (const employeeId of data.employeeIds) {
        notifPayload.push({ employee_id: employeeId, body: message.body });
        filters.push(
          { field: 'tag', key: 'employeeId', relation: '=', value: employeeId },
          { operator: 'OR' }
        );
      }
      filters.splice(-1, 1);
      await Notif.bulkCreate(notifPayload);
      /**
       * send notification
       */
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

module.exports = ScheduleSwapApproval;

const { oneSignalApi } = require('@helpers');
const EVENT = require('./constants');

class RejectMember {
  constructor(observable) {
    this.observable = observable;
  }

  listenRejectMember() {
    this.observable.addListener(EVENT.REJECT_MEMBER, async data => {
      const filters = [];
      const HEADING_MESSAGE = 'Status Gabung Perusahaan';
      const BODY_MESSAGE = `Anda telah ditolak dari perusahaan ${data.companyName}`;

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
        filters,
        headings: { en: HEADING_MESSAGE },
        contents: { en: BODY_MESSAGE },
        data: {
          memberApproval: 'rejected'
        }
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

module.exports = RejectMember;

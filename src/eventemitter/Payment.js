require('dotenv').config();
const { oneSignalApi } = require('@helpers');
const { notifications: Notif } = require('@models');
const EVENT = require('./constants');

class Payment {
  constructor(observable) {
    this.observable = observable;
  }

  listenPayment() {
    this.observable.addListener(EVENT.PAYMENT, async data => {
      let filters = [];

      await Notif.create({ employee_id: data.employeeId, body: data.description });

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
        headings: { en: data.title },
        data: {
          transaction_id: data.transaction_id,
          type: data.type,
          payment_method: data.payment_method,
          payment_status: data.status
        },
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

module.exports = Payment;

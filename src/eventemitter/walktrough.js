require('dotenv').config();
const { oneSignalApi } = require('@helpers');
const EVENT = require('./constants');

class Walktrough {
  constructor(observable) {
    this.observable = observable;
  }

  listenCheckout() {
    this.observable.addListener(EVENT.WALKTROUGH_CHECKOUT, async eventPayload => {
      let filters = [];
      for (let i = 0; i < eventPayload.length; i++) {
        // prettier-ignore
        /* eslint-disable quotes */
        filters.push(
          {
            field: 'tag',
            key: 'employeeId',
            relation: '=',
            value: eventPayload[i].id
          },
          { operator: 'OR' }
        );
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

      // prettier-ignore
      /* eslint-disable quotes */
      const payload = {
        "filters": filters,
        "data": {
          demo_mode: '1',
        },
        "headings": {"en": "karyawan Checkout"},
        "contents": {"en": "walktrough step 4 berakhir"}
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

module.exports = Walktrough;

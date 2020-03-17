const { Sequelize, transactions: Transaction, notifications: Notif } = require('@models');
const { oneSignalApi } = require('@helpers');
const EVENT = require('../constants');

class CronPendingTransaction {
  constructor(observable) {
    this.observable = observable;
  }

  getDayDetail(day) {
    const year = day.getFullYear();
    const month =
      (day.getMonth() + 1).toString().length === 2
        ? `${day.getMonth() + 1}`
        : `0${day.getMonth() + 1}`;
    const date = day.getDate().toString().length === 2 ? `${day.getDate()}` : `0${day.getDate()}`;
    const hours =
      day.getHours().toString().length === 2 ? `${day.getHours()}` : `0${day.getHours()}`;
    const minutes =
      day.getMinutes().toString().length === 2 ? `${day.getMinutes()}` : `0${day.getMinutes()}`;
    const seconds =
      day.getSeconds().toString().length === 2 ? `${day.getSeconds()}` : `0${day.getSeconds()}`;

    return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
  }

  listenCronPendingTransaction() {
    this.observable.addListener(EVENT.CRON_PENDING_TRANSACTION, async () => {
      let today = new Date();
      today = new Date(`${today} -0700`);
      const twentyFourHour = 1000 * 60 * 60 * 24;
      const pendingTime = new Date(today - twentyFourHour);
      const cronDate = this.getDayDetail(pendingTime);
      const cronCandidates = await Transaction.findAll({
        where: [
          Sequelize.where(
            Sequelize.fn(
              'DATE_FORMAT',
              Sequelize.col('transactions.created_at'),
              '%Y-%m-%d %H:%i:%s'
            ),
            '<=',
            cronDate
          ),
          {
            payment_status: '02'
          }
        ]
      });

      let notifications = [];
      const HEADING_MESSAGE = 'Transaksi pending yang telah kadaluarsa';
      for (const data of cronCandidates) {
        let filters = [];
        const message = `Transaksi ${data.id_description} pada ${data.created_at} telah kadaluarsa`;
        await Transaction.update({ payment_status: '01' }, { where: { id: data.id } });

        const payloadNotif = {
          employee_id: data.employee_id,
          body: message
        };

        notifications.push(payloadNotif);
        filters.push({ field: 'tag', key: 'employeeId', relation: '=', value: data.employee_id });
        if (process.env.NODE_ENV !== 'production') {
          // prettier-ignore
          /* eslint-disable quotes */
          filters.push(
            {"operator": "AND"},
            {"field": "tag", "key": "env", "relation": "=", "value": "development"}
          );
        }

        /* eslint-disable quotes */
        const payload = {
          filters: filters,
          headings: { en: HEADING_MESSAGE },
          contents: { en: message }
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
      }

      await Notif.bulkCreate(notifications);
    });
  }
}

module.exports = CronPendingTransaction;

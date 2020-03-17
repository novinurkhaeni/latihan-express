const {
  companies: Companies,
  subscription_details: SubscriptionDetails,
  subscriptions: Subscriptions,
  journals: Journals,
  employees: Employees
} = require('@models');

const EVENT = require('../constants');

class Subscribing {
  constructor(observable) {
    this.observable = observable;
  }
  listenSubscribing() {
    this.observable.addListener(EVENT.SUBSCRIBING, async () => {
      let date = new Date();
      date = new Date(`${date} -0700`);
      date = `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getDate()}`;
      const cronCandidates = await SubscriptionDetails.findAll({
        where: { active: 1, end_period: date },
        include: { model: Companies, include: { model: Employees, where: { role: 1 } } }
      });
      const deactiveSubs = await SubscriptionDetails.findAll({
        where: { active: 0, date_to_active: date }
      });

      let subscriptions;
      if (cronCandidates.length) {
        subscriptions = await Subscriptions.findAll();
      }
      let journalPayload = [];
      for (const data of cronCandidates) {
        let compose;
        if (!data.date_to_deactive) {
          const subscribeData = subscriptions.filter(val => val.id === data.subscribe_id);
          compose = {
            employee_id: data.company.employees[0].id,
            type: 'subscribe',
            debet: 0,
            kredit: subscribeData[0].price,
            description: `Tagihan berlangganan fitur ${subscribeData[0].subscribe_type}, durasi ${subscribeData[0].subscribe_freq} bulan. -- ${subscribeData[0].description}`
          };
          const endPeriod = new Date().setMonth(
            new Date().getMonth() + parseInt(subscribeData[0].subscribe_freq)
          );
          const composeSubscribeDetail = {
            start_period: date,
            end_period: new Date(endPeriod)
          };
          await SubscriptionDetails.update(composeSubscribeDetail, { where: { id: data.id } });
        } else {
          const findPair = deactiveSubs.filter(
            val => val.date_to_active === date && val.company_id === data.company_id
          );
          if (findPair.length) {
            const subscribeData = subscriptions.filter(val => val.id === findPair[0].subscribe_id);
            compose = {
              employee_id: data.company.employees[0].id,
              type: 'subscribe',
              debet: 0,
              kredit: subscribeData[0].price,
              description: `Tagihan berlangganan fitur ${subscribeData[0].subscribe_type}, durasi ${subscribeData[0].subscribe_freq} bulan. -- ${subscribeData[0].description}`
            };
            await SubscriptionDetails.update({ active: 1 }, { where: { id: findPair[0].id } });
            await SubscriptionDetails.update({ active: 0 }, { where: { id: data.id } });
          } else {
            await SubscriptionDetails.update({ active: 0 }, { where: { id: data.id } });
          }
        }
        if (compose) {
          journalPayload.push(compose);
        }
      }
      if (journalPayload.length) {
        await Journals.bulkCreate(journalPayload);
      }
    });
  }
}

module.exports = Subscribing;

require('module-alias/register');
const { response } = require('@helpers');
const {
  employees: EmployeeModel,
  journals: JournalModel,
  subscription_details: SubscribeDetailModel,
  subscriptions: SubscriptionModel,
  companies: CompanyModel
} = require('@models');

const subscriptionService = {
  getCompanySubs: async (req, res) => {
    const { company_id: companyId } = req.params;

    try {
      let companySubs = await CompanyModel.findOne({
        where: { id: companyId },
        include: {
          model: SubscriptionModel,
          through: {
            where: { active: 1 },
            attributes: ['id', 'active', 'start_period', 'end_period', 'created_at', 'updated_at']
          }
        }
      });

      if (!companySubs.subscriptions || companySubs.subscriptions.length <= 0) {
        companySubs = await CompanyModel.findOne({
          include: {
            model: SubscriptionModel,
            through: {
              where: { company_id: companyId },
              order: [['updated_at', 'DESC']],
              attributes: ['id', 'active', 'start_period', 'end_period', 'created_at', 'updated_at']
            }
          }
        });

        if (!companySubs.subscriptions || companySubs.subscriptions.length <= 0) {
          return res.status(200).json(response(true, 'Data berlangganan berhasil diminta', null));
        }
      }

      companySubs = Object.assign({
        id: companySubs.subscriptions[0].subscription_details.id,
        company_id: companySubs.id,
        subscribe_id: companySubs.subscriptions[0].id,
        active: companySubs.subscriptions[0].subscription_details.active,
        subscribe_type: companySubs.subscriptions[0].subscribe_type,
        subscribe_freq: companySubs.subscriptions[0].subscribe_freq,
        description: companySubs.subscriptions[0].description,
        price: companySubs.subscriptions[0].price,
        start_period: companySubs.subscriptions[0].subscription_details.start_period,
        end_period: companySubs.subscriptions[0].subscription_details.end_period,
        subscribe_date: companySubs.subscriptions[0].subscription_details.created_at,
        subscribe_changed: companySubs.subscriptions[0].subscription_details.updated_at
      });

      return res
        .status(200)
        .json(response(true, 'Data berlangganan berhasil diminta', companySubs));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getSubscription: async (req, res) => {
    try {
      const subscriptions = await SubscriptionModel.findAll();
      return res
        .status(200)
        .json(response(true, 'Berhasil mengambil daftar berlangganan', subscriptions));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  updateSubscription: async (req, res) => {
    const { subscribe_id: subscribeId } = req.body.data;
    const { company_id: companyId } = req.params;
    const { employeeId } = res.local.users;

    try {
      let isManager = await EmployeeModel.findOne({ where: { id: employeeId, role: 1 } });
      if (!isManager) {
        return res.status(400).json(response(false, 'Anda bukan manager'));
      }

      let subscribe = await SubscribeDetailModel.findOne({
        where: { company_id: companyId, active: 1 }
      });
      let subscribeData = await SubscriptionModel.findOne({ where: { id: subscribeId } });

      let journal;
      if (!subscribe) {
        journal = await JournalModel.create({
          employee_id: employeeId,
          company_id: companyId,
          type: 'subscribe',
          debet: 0,
          kredit: subscribeData.price,
          description: `Tagihan berlangganan fitur ${subscribeData.subscribe_type}, durasi ${subscribeData.subscribe_freq} bulan. -- ${subscribeData.description}`
        });
        if (!journal) {
          return res.status(400).json(response(false, 'Gagal membuat tagihan berlangganan'));
        }

        const startPeriod = new Date();
        let endPeriod = new Date().setMonth(
          new Date().getMonth() + parseInt(subscribeData.subscribe_freq)
        );
        endPeriod = new Date(endPeriod).setDate(new Date().getDate() - 1);
        subscribe = await SubscribeDetailModel.create({
          company_id: companyId,
          subscribe_id: subscribeId,
          start_period: startPeriod,
          end_period: new Date(endPeriod),
          active: 1
        });
      } else {
        const subscribeDate = new Date(subscribe.updated_at);
        const nextMonth = subscribeDate.setMonth(subscribeDate.getMonth() + 1);

        subscribe = await SubscribeDetailModel.findOne({
          where: { company_id: companyId, date_to_active: nextMonth }
        });

        if (subscribe) {
          return res
            .status(400)
            .json(
              response(
                false,
                'Anda sudah membuat perubahan berlangganan untuk bulan depan, silakan tunggu bulan depan atau hubungi customer service kami'
              )
            );
        }
        if (parseInt(subscribeData.subscribe_freq)) {
          let endPeriod = new Date(nextMonth).setMonth(
            new Date(nextMonth).getMonth() + parseInt(subscribeData.subscribe_freq)
          );
          endPeriod = new Date(endPeriod).setDate(new Date(endPeriod).getDate() - 1);
          subscribe = await SubscribeDetailModel.create({
            company_id: companyId,
            subscribe_id: subscribeId,
            date_to_active: nextMonth,
            start_period: nextMonth,
            end_period: new Date(endPeriod)
          });
        }

        subscribe = await SubscribeDetailModel.update(
          { date_to_deactive: nextMonth, end_period: nextMonth },
          { where: { company_id: companyId, active: 1 } }
        );
      }

      return res.status(200).json(response(true, 'Berhasil berlangganan pasca bayar'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = subscriptionService;

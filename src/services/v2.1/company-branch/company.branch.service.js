require('module-alias/register');
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const {
  companies: Company,
  company_settings: CompanySettings,
  subscription_details: SubscriptionDetails,
  subscriptions: Subscriptions,
  journals: Journals
} = require('@models');
const { response } = require('@helpers');

const companyBranch = {
  create: async (req, res) => {
    const { data } = req.body;
    const { companyParentId, employeeId } = res.local.users;
    try {
      const existingName = data.company.company_name;
      let finalCode;
      let codeName = existingName
        .match(/(?![EIOU])[B-Z]/gi)
        .toString()
        .replace(/,/g, '')
        .substring(0, 3)
        .toUpperCase();
      if (codeName.length < 3) {
        const long = 3 - codeName.length;
        codeName = codeName + 'X'.repeat(long);
      }
      let company = await Company.findOne({
        order: [['codename', 'DESC']],
        where: { codename: { [Op.regexp]: `${codeName}[:0-9:]` }, registration_complete: 0 }
      });

      if (company) {
        const payload = Object.assign({}, data.company, {
          active: 1,
          registration_complete: 1,
          parent_company_id: companyParentId
        });
        await Company.update(payload, {
          where: { id: company.id }
        });
        const companySettings = await CompanySettings.findOne({
          where: { company_id: company.id }
        });
        if (companySettings) {
          await CompanySettings.update(data.company_settings, {
            where: { company_id: company.id }
          });
        } else {
          const payload = Object.assign({}, data.company_settings, { company_id: company.id });
          await CompanySettings.create(payload);
        }
      } else {
        const isCodenameUsed = await Company.findOne({
          order: [['codename', 'DESC']],
          where: { codename: { [Op.regexp]: `${codeName}[:0-9:]` } }
        });

        if (isCodenameUsed) {
          let lastNums = isCodenameUsed.codename.substr(-3);
          lastNums = parseInt(lastNums);
          lastNums++;
          lastNums = ('0000' + lastNums).substr(-3);
          finalCode = codeName + lastNums;
        } else {
          const lastNum = '001';
          finalCode = codeName + lastNum;
        }

        let payload = Object.assign({}, data.company, {
          codename: finalCode,
          parent_company_id: companyParentId,
          active: 1,
          registration_complete: 1
        });
        company = await Company.create(payload);
        payload = Object.assign({}, data.company_settings, { company_id: company.id });
        await CompanySettings.create(payload);
      }

      let subscribeData = await Subscriptions.findOne({
        where: { id: data.subscription.subscribe_id }
      });

      const startPeriod = new Date();
      let endPeriod = new Date().setMonth(
        new Date().getMonth() + parseInt(subscribeData.subscribe_freq)
      );
      endPeriod = new Date(endPeriod).setDate(new Date().getDate() - 1);
      await SubscriptionDetails.create({
        company_id: company.id,
        subscribe_id: data.subscription.subscribe_id,
        start_period: startPeriod,
        end_period: new Date(endPeriod),
        active: 1
      });
      const payloadJournal = [
        {
          employee_id: employeeId,
          company_id: company.id,
          type: 'subscribe',
          debet: 0,
          kredit: subscribeData.price,
          description: `Tagihan berlangganan fitur ${subscribeData.subscribe_type}, durasi ${subscribeData.subscribe_freq} bulan. -- ${subscribeData.description}`
        },
        {
          employee_id: employeeId,
          company_id: company.id,
          type: 'fee',
          debet: 0,
          kredit: 200000,
          description: `Tagihan pembuatan lokasi baru`
        }
      ];
      await Journals.bulkCreate(payloadJournal);

      return res.status(201).json(response(true, 'Company has been successfully created', company));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = companyBranch;

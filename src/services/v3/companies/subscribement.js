/* eslint-disable indent */
require('module-alias/register');
const {
  Sequelize: { Op }
} = require('sequelize');
const { response, dateConverter } = require('@helpers');
const {
  subscribements: Subscribement,
  transactions: Transaction,
  packages: Package,
  package_details: PackageDetail,
  companies: Company
} = require('@models');

class Subscribements {
  constructor(req, res) {
    this.req = req;
    this.res = res;
  }

  async get() {
    const { company_id } = this.req.params;
    const { companyParentId } = this.res.local.users;
    const dateNow = dateConverter(new Date());
    let isDimMode = false;
    try {
      // Find Branches
      let companyIds = await Company.findAll({
        where: { parent_company_id: companyParentId, active: 1 },
        attributes: ['id']
      });
      companyIds = companyIds.map(val => val.id);
      const subscribement = await Subscribement.findOne({
        where: { company_id: companyIds },
        include: { model: Transaction, where: { payment_status: '00' }, attributes: [] }
      });
      const subscribements = await Subscribement.findAll({
        where: {
          company_id,
          date_to_deactive: { [Op.gte]: dateNow },
          date_to_active: { [Op.lte]: dateNow }
        },
        include: [
          { model: Transaction, where: { payment_status: '00' }, attributes: [] },
          { model: Package, include: { model: PackageDetail } }
        ]
      });

      // Only Check Dim Mode if Company Have Already Subscribed
      if (subscribement !== null) {
        const checkSubscribements = await Subscribement.findAll({
          where: {
            company_id: companyIds,
            date_to_deactive: { [Op.gte]: dateNow },
            date_to_active: { [Op.lte]: dateNow }
          },
          include: [{ model: Transaction, where: { payment_status: '00' }, attributes: [] }]
        });

        let subsCompanyIds = [...new Set(checkSubscribements.map(item => item.company_id))];
        const joinedCompanyIds = subsCompanyIds.concat(companyIds);
        for (const companyId of joinedCompanyIds) {
          const ids = joinedCompanyIds.filter(val => val === companyId);
          if (ids.length === 1) {
            isDimMode = true;
            break;
          }
        }
      }

      const basicPackage = subscribements.find(val => val.package.type === 1);
      let abilities = [];
      if (subscribements.length) {
        for (const data of subscribements) {
          for (const ability of data.package.package_details) {
            abilities.push(ability.ability);
          }
        }
      }
      const responses = {
        ever_subscribed: subscribement !== null,
        is_dim_mode: isDimMode,
        subscribement: subscribements.length
          ? {
              date_to_deactive: basicPackage.date_to_deactive,
              abilities,
              packages: subscribements.map(val => {
                return {
                  id: val.package_id,
                  name: val.package.name,
                  type: val.package.type,
                  price: val.package.price,
                  daily_price: Math.round(val.package.price / 31),
                  icon: val.package.icon,
                  date_to_active: val.date_to_active,
                  date_to_deactive: val.date_to_deactive
                };
              })
            }
          : null
      };
      return this.res
        .status(200)
        .json(response(true, 'Data langganan terkini berhasil didapatkan', responses));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
}

module.exports = Subscribements;

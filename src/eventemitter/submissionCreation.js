const { oneSignalApi } = require('@helpers');
const {
  notifications: Notif,
  employees: Employee,
  companies: Company,
  abilities_category: AbilityCategory
} = require('@models');
const {
  Sequelize: { Op }
} = require('sequelize');
const EVENT = require('./constants');

class SubmissionCreation {
  constructor(observable) {
    this.observable = observable;
  }

  listenSubmissionCreation() {
    this.observable.addListener(EVENT.SUBMISSION_CREATION, async data => {
      const filters = [];
      const notifPayload = [];
      const roles = [1, 3, 4, 5, 6];
      const filteredRoles = [];

      const company = await Company.findOne({
        where: { parent_company_id: data.parentCompanyId },
        attributes: ['id']
      });

      const abilities1 = await AbilityCategory.findAll({
        where: { role: [1, 5], company_id: null }
      });

      const abilities2 = await AbilityCategory.findAll({
        where: { role: [3, 4, 6], company_id: company.id }
      });

      const abilities = abilities1.concat(abilities2);
      for (const role of roles) {
        let ability = abilities.find(val => val.role == role);
        if (ability) {
          ability = ability.ability.split(',');
          const findAbility = ability.find(val => val == data.ability);
          if (findAbility) {
            filteredRoles.push(role);
          }
        }
      }

      const employees = await Employee.findAll({
        attributes: ['id'],
        where: {
          role: { [Op.or]: filteredRoles },
          active: 1
        },
        include: {
          model: Company,
          where: { parent_company_id: data.parentCompanyId },
          required: true
        }
      });

      for (const employee of employees) {
        notifPayload.push({ employee_id: employee.id, body: data.message.body });
        filters.push(
          { field: 'tag', key: 'employeeId', relation: '=', value: employee.id },
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
        headings: { en: data.message.title },
        contents: { en: data.message.body }
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

module.exports = SubmissionCreation;

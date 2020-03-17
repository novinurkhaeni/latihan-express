/* eslint-disable no-case-declarations */
/* eslint-disable indent */
const { oneSignalApi } = require('@helpers');
const { notifications: Notif, employees: Employee, companies: Company } = require('@models');
const EVENT = require('./constants');
const {
  Sequelize: { Op }
} = require('sequelize');

class ScheduleSwapAgreement {
  constructor(observable) {
    this.observable = observable;
  }

  listenScheduleSwapAgreement() {
    this.observable.addListener(EVENT.SCHEDULE_SWAP_AGREEMENT, async data => {
      let message;
      let filters = [];
      switch (data.type) {
        case 'agree':
          /**
           * Find all manager, supervisor and operator
           */
          const employees = await Employee.findAll({
            where: {
              role: { [Op.or]: [1, 3, 4] }
            },
            include: {
              model: Company,
              where: { parent_company_id: data.applicant.parentCompanyId },
              required: true
            }
          });
          /**
           * compose message
           */
          message = {
            title: 'Pengajuan Tukar Jadwal',
            body: `${data.applicant.fullName} dan ${data.respondent.fullName} ingin melakukan tukar jadwal`
          };
          /**
           * store message
           */
          const notifPayload = [];
          for (const employee of employees) {
            notifPayload.push({ employee_id: employee.id, body: message.body });
            filters.push(
              { field: 'tag', key: 'employeeId', relation: '=', value: employee.id },
              { operator: 'OR' }
            );
          }
          filters.splice(-1, 1);
          await Notif.bulkCreate(notifPayload);
          break;

        case 'disagree':
          /**
           * compose message
           */
          message = {
            title: 'Permohonan Tukar Jadwal Ditolak',
            body: `Permohonan tukar jadwal telah ditolak oleh termohon yang bernama ${data.respondent.fullName}`
          };
          /**
           * store message
           */
          await Notif.create({ employee_id: data.applicant.employeeId, body: message.body });
          filters.push({
            field: 'tag',
            key: 'employeeId',
            relation: '=',
            value: data.applicant.employeeId
          });
          break;
        default:
          break;
      }
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

module.exports = ScheduleSwapAgreement;

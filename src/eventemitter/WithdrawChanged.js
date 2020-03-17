require('dotenv').config();
const { oneSignalApi, nodemailerMail, mailTemplates, formatCurrency } = require('@helpers');
const {
  notifications: Notif,
  employees: Employee,
  users: User,
  companies: Company
} = require('@models');
const EVENT = require('./constants');

class WithdrawChanged {
  constructor(observable) {
    this.observable = observable;
  }

  listenWithdrawApproved() {
    this.observable.addListener(EVENT.WITHDRAW_APPROVED, async data => {
      const employeeData = await Employee.findOne({
        where: { user_id: data.userId },
        attributes: ['role', 'id'],
        include: [
          {
            model: User,
            attributes: ['id', 'full_name', 'email']
          },
          { model: Company, attributes: ['company_name', 'name'] }
        ]
      });
      const HEADING_MESSAGE = `Tarikan GajianDulu nomor ${data.withdrawId} telah disetujui`;
      const BODY_MESSAGE = `Tarikan GajianDulu tanggal ${data.withdrawDate} dengan nomor Tarikan ${
        data.withdrawId
      } senilai Rp. ${formatCurrency(data.totalWithdraw)} telah disetujui dan ditransfer`;

      // prettier-ignore
      /* eslint-disable quotes */
      let payload = {
        "filters": [
          {"field": "tag", "key": "userId", "relation": "=", "value": data.userId}
        ],
        "data": {"foo": "bar"},
        "headings": {"en": HEADING_MESSAGE},
        "contents": {"en": BODY_MESSAGE}
      };
      if (process.env.NODE_ENV !== 'production') {
        // prettier-ignore
        /* eslint-disable quotes */
        payload.filters.push(
          {"operator": "AND"},
          {"field": "tag", "key": "env", "relation": "=", "value": "development"}
        );
      }
      const payloadAndroid = { ...payload, app_id: process.env.ANDROID_ONESIGNAL_APPID };
      const payloadIOS = { ...payload, app_id: process.env.IOS_ONESIGNAL_APPID };
      /* eslint-enable quotes */

      await Notif.create({
        employee_id: data.employeeId,
        body: BODY_MESSAGE
      });

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
      const emails = [data.userEmail, 'gajiandulu@atenda.id'];
      // SEND EMAIL
      /* eslint-disable */
      nodemailerMail.sendMail(
        {
          from: 'cs@atenda.id',
          to: emails, // An array if you have multiple recipients.
          subject: `Atenda: Tarikan GajianDulu: Berhasil - ${employeeData.user.full_name}`,
          //You can use "html:" to send HTML email content. It's magic!
          html: mailTemplates.withdrawStatusChange({
            teamName: employeeData.company.company_name || employeeData.company.name,
            employeeName: employeeData.user.full_name,
            totalWithdraw: formatCurrency(data.totalWithdraw),
            withdrawDate: data.withdrawDate,
            status: 'Berhasil'
          })
        },
        function(err, info) {
          if (err) {
            let errorLog = new Date().toISOString() + ' [Withdraw Approved]: ' + err + '\n';
            global.emailErrorLog.write(errorLog);
          }
        }
      );
      /* eslint-enable */
    });
  }

  listenWithdrawRejected() {
    this.observable.addListener(EVENT.WITHDRAW_REJECTED, async data => {
      const employeeData = await Employee.findOne({
        where: { user_id: data.userId },
        attributes: ['role', 'id'],
        include: [
          {
            model: User,
            attributes: ['id', 'full_name', 'email']
          },
          { model: Company, attributes: ['company_name', 'name'] }
        ]
      });
      const HEADING_MESSAGE = `Tarikan GajianDulu nomor ${data.withdrawId} ditolak`;
      const BODY_MESSAGE = `Tarikan GajianDulu tanggal ${data.withdrawDate} dengan nomor Tarikan ${
        data.withdrawId
      } senilai Rp. ${formatCurrency(data.totalWithdraw)} telah ditolak`;

      // prettier-ignore
      /* eslint-disable quotes */
      let payload = {
        "app_id": process.env.ONESIGNAL_APPID,
        "filters": [
          {"field": "tag", "key": "userId", "relation": "=", "value": data.userId}
        ],
        "data": {"foo": "bar"},
        "headings": {"en": HEADING_MESSAGE},
        "contents": {"en": BODY_MESSAGE}
      };
      if (process.env.NODE_ENV !== 'production') {
        // prettier-ignore
        /* eslint-disable quotes */
        payload.filters.push(
          {"operator": "AND"},
          {"field": "tag", "key": "env", "relation": "=", "value": "development"}
        );
      }
      /* eslint-enable quotes */

      await Notif.create({
        employee_id: data.employeeId,
        body: BODY_MESSAGE
      });

      oneSignalApi.post('/notifications', payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${process.env.ONESIGNAL_APIKEY}`
        }
      });
      const emails = [data.userEmail, 'gajiandulu@atenda.id'];
      // SEND EMAIL
      /* eslint-disable */
      nodemailerMail.sendMail(
        {
          from: 'cs@atenda.id',
          to: emails, // An array if you have multiple recipients.
          subject: `Atenda: Tarikan GajianDulu: Ditolak - ${employeeData.user.full_name}`,
          //You can use "html:" to send HTML email content. It's magic!
          html: mailTemplates.withdrawStatusChange({
            teamName: employeeData.company.company_name || employeeData.company.name,
            employeeName: employeeData.user.full_name,
            totalWithdraw: formatCurrency(data.totalWithdraw),
            withdrawDate: data.withdrawDate,
            status: 'Ditolak'
          })
        },
        function(err, info) {
          if (err) {
            let errorLog = new Date().toISOString() + ' [Withdraw Reject]: ' + err + '\n';
            global.emailErrorLog.write(errorLog);
          }
        }
      );
      /* eslint-enable */
    });
  }

  listenWithdrawRequest() {
    this.observable.addListener(EVENT.WITHDRAW_REQUEST, async data => {
      let emails = [];
      const employeeData = await Employee.findOne({
        where: { user_id: data.userId },
        attributes: ['role', 'id'],
        include: [
          {
            model: User,
            attributes: ['id', 'full_name', 'email']
          },
          { model: Company, attributes: ['company_name', 'name'] }
        ]
      });
      const managerData = await Employee.findAll({
        where: { company_id: data.companyId, role: '1' },
        include: [
          {
            model: User,
            attributes: ['id', 'full_name', 'email']
          }
        ]
      });
      const HEADING_MESSAGE = `Pengajuan tarikan GajianDulu`;
      // MESSAGE FOR MANAGER
      const BODY_MESSAGE = `Anggota ${
        employeeData.user.full_name
      } telah mengajukan tarikan GajianDulu sebesar Rp. ${formatCurrency(
        data.totalWithdraw
      )} pada tanggal ${data.thisDate}`;
      // MESSAGE FOR EMPLOYEE
      const BODY_MESSAGE2 = `Pengajuan tarikan GajianDulu atas nama ${
        employeeData.user.full_name
      } sebesar Rp. ${formatCurrency(data.totalWithdraw)} pada tanggal ${
        data.thisDate
      } telah berhasil diajukan`;

      /**
       * SEND NOTIFICATION FOR MANAGER
       */

      let filters = [];
      let payloadNotif = [];
      for (let i = 0; i < managerData.length; i++) {
        payloadNotif.push({
          employee_id: managerData[i].id,
          body: BODY_MESSAGE
        });
        // prettier-ignore
        /* eslint-disable quotes */
        filters.push({"field": "tag", "key": "employeeId", "relation": "=", "value": managerData[i].id}, {"operator": "OR"});
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

      await Notif.bulkCreate(payloadNotif);

      // prettier-ignore
      /* eslint-disable quotes */
      let payload = {
        app_id: process.env.ONESIGNAL_APPID,
        filters,
        headings: { en: HEADING_MESSAGE },
        contents: { en: BODY_MESSAGE }
      };

      oneSignalApi.post('/notifications', payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${process.env.ONESIGNAL_APIKEY}`
        }
      });

      /**
       * SEND NOTIFICATION FOR EMPLOYEE
       */

      filters = [];
      filters.push({ field: 'tag', key: 'userId', relation: '=', value: data.userId });
      if (process.env.NODE_ENV !== 'production') {
        // prettier-ignore
        /* eslint-disable quotes */
        filters.push(
          {"operator": "AND"},
          {"field": "tag", "key": "env", "relation": "=", "value": "development"}
        );
      }

      await Notif.create({
        employee_id: employeeData.id,
        body: BODY_MESSAGE2
      });

      payload = {
        app_id: process.env.ONESIGNAL_APPID,
        filters,
        data: { foo: 'bar' },
        headings: { en: HEADING_MESSAGE },
        contents: { en: BODY_MESSAGE2 }
      };
      // SEND NOTIFICATION FOR EMPLOYEE
      oneSignalApi.post('/notifications', payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${process.env.ONESIGNAL_APIKEY}`
        }
      });
      emails.push(employeeData.user.email);
      emails.push('gajiandulu@atenda.id');
      for (const data of managerData) {
        emails.push(data.user.email);
      }
      // SEND EMAIL TO MANAGER, EMPLOYEE AND ADMIN
      /* eslint-disable */
      nodemailerMail.sendMail(
        {
          from: 'cs@atenda.id',
          to: emails, // An array if you have multiple recipients.
          subject: `Atenda: Tarikan GajianDulu: Pengajuan - ${employeeData.user.full_name}`,
          //You can use "html:" to send HTML email content. It's magic!
          html: mailTemplates.withdrawStatusChange({
            teamName: employeeData.company.company_name || employeeData.company.name,
            employeeName: employeeData.user.full_name,
            totalWithdraw: formatCurrency(data.totalWithdraw),
            withdrawDate: data.thisDate,
            status: 'Pengajuan'
          })
        },
        function(err, info) {
          if (err) {
            let errorLog = new Date().toISOString() + ' [Withdraw Request]: ' + err + '\n';
            global.emailErrorLog.write(errorLog);
          }
        }
      );
      /* eslint-enable */
    });
  }
}

module.exports = WithdrawChanged;

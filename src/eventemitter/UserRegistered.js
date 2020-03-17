require('dotenv').config();
const { oneSignalApi, nodemailerMail } = require('@helpers');
const {
  notifications: Notif,
  employees: Employee,
  users: User,
  companies: Company
} = require('@models');
const EVENT = require('./constants');

class UserRegistered {
  constructor(observable) {
    this.observable = observable;
  }

  listenUserRegistered() {
    this.observable.addListener(EVENT.SEND_WELCOME, async data => {
      const BODY_MESSAGE = 'Terimakasih telah mendaftar di Atenda';
      const ownerFilters = [];
      // Find Complete Employee Data
      const employee = await Employee.findOne({
        where: { id: data.employeeId },
        include: { model: User, attributes: ['full_name'] }
      });

      // Find All User with Role 1 / Owner
      const owners = await Employee.findAll({
        where: { company_id: employee.company_id, role: 1 }
      });

      // Compose Owner Employee Ids
      const ownerEmployeeIds = owners.map(val => val.id);

      const OWNER_BODY_MESSAGE = `${employee.user.full_name} telah mendaftarkan diri untuk bergabung ke perusahaan anda`;

      const notifDatas = [{ employee_id: data.employeeId, body: BODY_MESSAGE }];
      for (const ownerEmployeeId of ownerEmployeeIds) {
        notifDatas.push({ employee_id: ownerEmployeeId, body: OWNER_BODY_MESSAGE });
        ownerFilters.push(
          { field: 'tag', key: 'employeeId', relation: '=', value: ownerEmployeeId },
          { operator: 'OR' }
        );
      }
      ownerFilters.splice(-1, 1);
      if (process.env.NODE_ENV !== 'production') {
        // prettier-ignore
        /* eslint-disable quotes */
        ownerFilters.push(
          {"operator": "AND"},
          {"field": "tag", "key": "env", "relation": "=", "value": "development"}
        );
      }

      await Notif.bulkCreate(notifDatas);

      // Notification for Employee
      /* eslint-disable quotes */
      let payload = {
        filters: [{ field: 'tag', key: 'userId', relation: '=', value: data.userId }],
        data: { foo: 'bar' },
        headings: { en: 'Selamat Datang di Atenda' },
        contents: { en: BODY_MESSAGE }
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

      // Notification for Owner

      /* eslint-disable quotes */
      payload = {
        filters: ownerFilters,
        headings: { en: 'Karyawan Baru' },
        contents: { en: OWNER_BODY_MESSAGE }
      };

      const ownerPayloadAndroid = { ...payload, app_id: process.env.ANDROID_ONESIGNAL_APPID };
      const ownerPayloadIOS = { ...payload, app_id: process.env.IOS_ONESIGNAL_APPID };

      oneSignalApi.post('/notifications', ownerPayloadAndroid, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${process.env.ANDROID_ONESIGNAL_APIKEY}`
        }
      });

      oneSignalApi.post('/notifications', ownerPayloadIOS, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${process.env.IOS_ONESIGNAL_APIKEY}`
        }
      });

      // SEND EMAIL REGISTER COMPLETED
      const employeeData = await Employee.findOne({
        where: { user_id: data.userId },
        attributes: ['role', 'salary', 'workdays', 'daily_salary'],
        include: [
          {
            model: User,
            attributes: ['email', 'full_name', 'phone', 'birthday']
          },
          { model: Company, attributes: ['name', 'company_name', 'address', 'phone'] }
        ]
      });

      /* eslint-disable */
      nodemailerMail.sendMail(
        {
          from: 'cs@atenda.id',
          to: employeeData.user.email, // An array if you have multiple recipients.
          subject: `Register Berhasil - ${employeeData.company.company_name} - Atenda`,
          //You can use "html:" to send HTML email content. It's magic!
          html: `
            <div style="max-width:600px!important;font-family:Helvetica">
            <center>
            <img src="https://${config.host}/uploads/email/logo.png" style="width: 400px"/>
            <h1>Register Berhasil - ${employeeData.company.company_name} - Atenda</h1>
            <h2>Terima kasih telah melakukan registrasi akun Atenda</h2>
            <h4>Berikut adalah data lengkah4 registrasi anda.</h4>
            <p>Nama Lengkap   : ${employeeData.user.full_name}</p>
            <p>Email          : ${employeeData.user.email}</p>
            <p>Telepon        : ${employeeData.user.phone}</p>
            <p>Tanggal Lahir  : ${employeeData.user.birthday}</p><br>
            <h4>Bekerja pada perusahaan bernama ${employeeData.company.company_name}</h4>
            <h3>${employeeData.company.address} - Telp.: ${employeeData.company.phone}</h3>
            <p>Posisi             : ${
              employeeData.role.toString() === '1' ? 'Pemilik Usaha' : 'Karyawan'
            }</p>
            <p>Gaji per bulan     : ${employeeData.salary}</p>
            <p>Jumlah hari kerja  : ${employeeData.workdays}</p>
            <p>Gaji per hari      : ${employeeData.daily_salary}</p><br>
            <h4>Simpan email ini sebagai bukti informasi bahwa anda telah berhasil melakukan registrasi.</h4>
            <hr>
            <p>Jika kamu memiliki pertanyaan atau klarifikasi lebih lanjut, kamu dapat selalu menghubungi kami melalui:</p>
            <p>Email: cs@atenda.id</p>
            <p>LINE ID: @atendaid</p>
            <br>
            <p>Terima kasih atas dukungan dan kepercayaan kakak menggunakan GajianDulu!</p>
            <center>
              <a href="http://www.facebook.com/atenda.id" target="_blank" rel="noreferrer"><img src="https://${
                config.host
              }/uploads/email/facebook-icon.png"/></a>
              <a href="http://atenda.id" target="_blank" rel="noreferrer"><img src="https://${
                config.host
              }/uploads/email/link-icon.png"/></a>
              <a href="http://www.instagram.com/atenda.id" target="_blank" rel="noreferrer"><img src="https://${
                config.host
              }/uploads/email/instagram-icon.png"/></a>
            </center>
            <p>Copyright © 2019 PT. Atenda Rumah Kita, All rights reserved.</p>
            <p>Our mailing address is:</p>
            <p>cs@atenda.id</p>
            </center>
            </div>
            `
        },
        function(err, info) {
          if (err) {
            let errorLog = new Date().toISOString() + ' [Complete Register]: ' + err + '\n';
            global.emailErrorLog.write(errorLog);
          }
        }
      );
      /* eslint-enable */
    });
  }

  listenUserJoined() {
    this.observable.addListener(EVENT.NEW_EMPLOYEE_JOINED, async data => {
      const employeeData = await Employee.findOne({
        where: { user_id: data.userId },
        attributes: ['role'],
        include: [
          {
            model: User,
            attributes: ['full_name']
          },
          { model: Company, attributes: ['name'] }
        ]
      });

      const managerData = await Employee.findAll({
        where: { company_id: data.companyId, role: '1' }
      });
      const HEADING_MESSAGE = `${employeeData.user.full_name} baru saja bergabung`;
      const BODY_MESSAGE = `${employeeData.user.full_name} baru saja bergabung ke ${
        employeeData.company.name
      } sebagai ${employeeData.role.toString() === '1' ? 'Pemilik Usaha' : 'Karyawan'}`;

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
      const payload = {
        "filters": filters,
        "headings": {"en": HEADING_MESSAGE},
        "contents": {"en": BODY_MESSAGE}
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
  listenMemberAprroved() {
    this.observable.addListener(EVENT.MEMBER_APPROVED, async data => {
      let filters = [];
      const company = await Company.findOne({
        where: { id: data.companyId },
        attributes: ['company_name', 'name']
      });
      const HEADING_MESSAGE = 'Status Permohonan Gabung Tim';
      const BODY_MESSAGE = `Permohonan anda untuk bergabung dengan tim ${company.company_name ||
        company.name} telah disetujui oleh pemilik usaha.`;

      await Notif.create({ employee_id: data.employeeId, body: BODY_MESSAGE });

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
        filters: filters,
        headings: { en: HEADING_MESSAGE },
        contents: { en: BODY_MESSAGE },
        data: {
          memberApproval: 'approved'
        }
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

module.exports = UserRegistered;

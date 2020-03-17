/* eslint-disable indent */
require('module-alias/register');
// const {
//   Sequelize: { Op }
// } = require('sequelize');
const twilio = require('twilio');
const { otps: Otp } = require('@models');
const { response } = require('@helpers');

const otpService = {
  create: async (req, res) => {
    const { data } = req.body;
    const { via } = req.query;
    let createOrUpdateOtp;
    const smsSender = process.env.SMS_SENDER;
    const waSender = process.env.WA_SENDER;
    try {
      const code = ('000000' + Math.floor(Math.random() * Math.pow(10, 6))).substr(-6);
      const phone = parseInt(data.phone, 10);
      const payload = {
        phone,
        code
      };
      // Check Code Exist or Not
      const checkCode = await Otp.findOne({ where: { phone } });
      if (checkCode) {
        createOrUpdateOtp = await Otp.update(payload, { where: { id: checkCode.id } });
      } else {
        createOrUpdateOtp = await Otp.create(payload);
      }
      if (!createOrUpdateOtp) {
        return res.status(400).json(response(false, 'Gagal mengirim OTP'));
      }
      // Create Twilio Instance
      const to = `${via === 'wa' ? 'whatsapp:+62' : '+62'}${phone}`;
      const from = via === 'wa' ? waSender : smsSender;
      const client = new twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
      client.messages
        .create({
          body: `Kode untuk aplikasi Atenda anda adalah ${code}`,
          to,
          from
        })
        .then(() => {
          return res.status(200).json(response(true, 'OTP berhasil dikirim'));
        })
        .catch(err => {
          return res.status(400).json(response(false, `Terjadi kesalahan. ${err}`));
        });
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  verify: async (req, res) => {
    const { code, phone } = req.query;
    try {
      const findCode = await Otp.findOne({ where: { code, phone: parseInt(phone, 10) } });
      if (!findCode) {
        return res.status(400).json(response(false, 'Kode yang anda masukkan salah'));
      }
      // Check is Code has Expired or Not
      let minuteDiff = Math.abs(new Date() - new Date(`${findCode.updated_at} +0700`));
      minuteDiff = Math.floor(minuteDiff / 1000 / 60);
      if (minuteDiff > 60) {
        return res.status(400).json(response(false, 'Kode yang anda masukkan sudah tidak berlaku'));
      }
      // Delete Code if Validation Passed
      await Otp.destroy({ where: { id: findCode.id } });
      return res.status(200).json(response(true, 'OTP berhasil diverifikasi'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = otpService;

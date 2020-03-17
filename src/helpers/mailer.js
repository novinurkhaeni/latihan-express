require('dotenv').config();
const nodemailer = require('nodemailer');

let auth;
let nodemailerMail;

if (process.env.NODE_ENV === 'production') {
  auth = {
    host: process.env.MAILER_HOST,
    port: process.env.MAILER_PORT,
    secure: true,
    auth: {
      user: process.env.MAILER_USER,
      pass: process.env.MAILER_PASS
    },
    debug: true
  };
  nodemailerMail = nodemailer.createTransport(auth);
  nodemailerMail.verify(function(error, success) {
    if (error) {
      let errorLog = new Date().toISOString() + ' [Verify SMTP connection]: ' + error + '\n';
      global.emailErrorLog.write(errorLog);
    }
  });
} else {
  auth = {
    host: 'smtp.mailtrap.io',
    port: 2525,
    auth: {
      user: 'a19ab804bc93a8',
      pass: 'c95e5048eb900d'
    }
  };
  nodemailerMail = nodemailer.createTransport(auth);
}

module.exports = nodemailerMail;

const config = require('config');

const emailVerification = info =>
  /*eslint-disable indent */
  `
    <div style="max-width:600px!important;font-family:Helvetica">
    <right>
    <img src="https://${config.host}/uploads/email/logo.png" style=" max-width: 200px; max-height:50px;"/>
    <h1>Hi ${info.fullName}</h1>
    <h2>Thanks for getting started with Atenda!</h2>
    <h2>We need to a confirmation of your email address. Click below to confirm your email address</h2>
    <a href="${info.url}">Click here to verify your email</a>
    <br>
    <br>
    <br>
    <p>If you have problems, please paste the above URL into your web browser.</p>
    <br>
    <hr>
    <br>
    <p>This email was sent to you as a registered member of Atenda. To update your email preferences <a>click here</a>. </p>
    <p>Use of the service and website is subject to our Terms of Use and Privacy Statement. </p>
    <br>
    <p>© 2020 Atenda. All rights reserved</p>
    </right>
    </div>
  `;

module.exports = emailVerification;

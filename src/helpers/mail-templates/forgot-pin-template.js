const config = require('config');

const forgotPinTemplate = info =>
  /*eslint-disable indent */
  `
    <div style="max-width:600px!important;font-family:Helvetica">
    <right>
    <img src="https://${config.host}/uploads/email/logo.png" style=" max-width: 200px; max-height:50px;"/>
    <h1>Hi ${info.owner.full_name}</h1>
    <h2>${info.employee.full_name} recently requested a forgot pin for </h2>
    <br>
    <h2>Nomor Handphone : ${info.employee.phone}</h2>
    <h2>PIN: ${info.newPin} </h2>
    <br>
    <br>
    <br>
    <p>if you didn't request a passsword reset. please let us know.</p>
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

module.exports = forgotPinTemplate;

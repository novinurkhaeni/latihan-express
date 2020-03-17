const config = require('config');

const companyReminder = data =>
  /*eslint-disable indent */
  `
    <div style="max-width:600px!important;font-family:Helvetica">
    <center>
    <img src="https://${config.host}/uploads/email/logo.png" style=" width:400px;"/>
    <h1>Export Excel: ${data.type}</h1>
    <p>Silakan download file excel dari attachment email ini</p>
    <br>
    <p>Email: cs@atenda.id</p>
    <p>LINE ID: @atendaid</p>
    <br>
    <center>
      <a href="https://www.facebook.com/atenda.id" target="_blank" rel="noreferrer"><img src="https://${config.host}/uploads/email/facebook-icon.png"/></a>
      <a href="http://atenda.id" target="_blank" rel="noreferrer"><img src="https://${config.host}/uploads/email/link-icon.png"/></a>
      <a href="https://www.instagram.com/atenda.id" target="_blank" rel="noreferrer"><img src="https://${config.host}/uploads/email/instagram-icon.png"/></a>
    </center>
    <p>Copyright © 2020 PT. Atenda Rumah Kita, All rights reserved.</p>
    <p>Our mailing address is:</p>
    <p>cs@atenda.id</p>
    </center>
    </div>
  `;

module.exports = companyReminder;

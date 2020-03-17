const config = require('config');

const forgotPasswordTemplate = info =>
  /*eslint-disable indent */
  `
    <div style="max-width:600px!important;font-family:Helvetica">
    <center>
    <img src="https://${config.host}/uploads/email/logo.png" style=" width:400px;"/>
    <h2>Reset Password</h2>
    <p>Anda telah melakukan permintaan untuk reset password dan permintaan telah berhasil untuk mengganti password akun anda.</p>
    <h4>===================================================</h4>
    <p>Berikut adalah password baru anda: <b>${info.passgen}</b></p>
    <h4>===================================================</h4>
    <hr>
    <p>Jika kamu memiliki pertanyaan atau klarifikasi lebih lanjut, kamu dapat selalu menghubungi kami melalui:</p>
    <p>Email: cs@atenda.id</p>
    <p>LINE ID: @atendaid</p>
    <br>
    <p>Terima kasih atas dukungan dan kepercayaan kakak menggunakan Atenda!</p>
    <center>
      <a href="https://www.facebook.com/atenda.id" target="_blank" rel="noreferrer"><img src="https://${config.host}/uploads/email/facebook-icon.png"/></a>
      <a href="http://atenda.id" target="_blank" rel="noreferrer"><img src="https://${config.host}/uploads/email/link-icon.png"/></a>
      <a href="https://www.instagram.com/atenda.id" target="_blank" rel="noreferrer"><img src="https://${config.host}/uploads/email/instagram-icon.png"/></a>
    </center>
    <p>Copyright © 2019 PT. Atenda Rumah Kita, All rights reserved.</p>
    <p>Our mailing address is:</p>
    <p>cs@atenda.id</p>
    </center>
    </div>
  `;

module.exports = forgotPasswordTemplate;

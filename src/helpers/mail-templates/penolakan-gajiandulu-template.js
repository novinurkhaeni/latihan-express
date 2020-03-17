const config = require('config');

const penolakanGajianDuluTemplate = info =>
  /*eslint-disable indent */
  `
    <div style="max-width:600px!important;font-family:Helvetica">
    <center>
    <img src="https://${config.host}/uploads/email/logo.png" style=" width:400px;"/>
    <h2>Penolakan Tarikan GajianDulu</h2>
    <p>Mohon maaf, Tarikan GajianDulu berikut:</p>
    <p>Nomor Tarikan: ${info.wdid}</p>
    <p>Tanggal Tarikan: ${info.wdCreated}</p>
    <p>Tarikan Bersih: Rp ${info.wdNetto}</p>
    <p>Telah ditolak oleh Atenda.</p>
    <p>Adapun pertanyaan lebih lanjut silakan hubungi kami melalui aplikasi mobile Atenda</p>
    <p>Atau dapat menghubungi customer service kami.</p>
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

module.exports = penolakanGajianDuluTemplate;

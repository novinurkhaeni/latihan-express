const config = require('config');

const managerInviting = ({ companyData, data }) =>
  /*eslint-disable indent */
  `
    <div style="max-width:600px!important;font-family:Helvetica">
    <center>
    <img src="https://${config.host}/uploads/email/logo.png" style=" width:400px;"/>
    <h1>Undangan Anggota ${companyData.company_name}</h1>
    <p>Anda mendapatkan undangan untuk bergabung dengan ${companyData.company_name}</p>
    <p>Manajer perusahaan telah mengundang anda dengan informasi berikut:</p><br>
    <p>Nama Lengkap : ${data.name}</p>
    <p>Email        : ${data.email}</p>
    <p>Telepon      : ${data.phone}</p><br>
    <p>Mohon lakukan register ulang di dalam aplikasi ponsel Atenda dengan alamat email harus sesuai data tertera di atas.</p>
    <p>Lalu, silakan anda masukkan nama kode perusahaan setelah melewati tahap registrasi ulang, dengan kode di bawah ini.</p>
    <p>--------------------------------------------------------------------------</p>
    <h2>${companyData.codename}</h2>
    <p>--------------------------------------------------------------------------</p>
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

module.exports = managerInviting;

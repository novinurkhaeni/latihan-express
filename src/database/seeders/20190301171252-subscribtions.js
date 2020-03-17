'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.bulkInsert('Person', [{
        name: 'John Doe',
        isBetaMember: false
      }], {});
    */
    const compose = [
      {
        subscribe_type: 'Gratis',
        subscribe_freq: 0,
        price: 0,
        description: 'Absensi, Penjadwalan, Shifts, Perhitungan Gaji, Laporan Anggota',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        subscribe_type: 'Basic',
        subscribe_freq: 1,
        price: 200000,
        description:
          '+Absensi Selfie, +Penggunaan Mesin Absensi, +Golongan Gaji Tak Terbatas, Operator & Supervisor',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        subscribe_type: 'Basic',
        subscribe_freq: 12,
        price: 1920000,
        description: 'Bayar per tahun hemat 20% dengan harga Rp. 160.000/bln',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        subscribe_type: 'Perusahaan',
        subscribe_freq: 1,
        price: 500000,
        description: 'Fitur Basic, +Upload Sejumlah Anggota, +Divisi',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        subscribe_type: 'Perusahaan',
        subscribe_freq: 12,
        price: 4800000,
        description: 'Bayar per tahun hemat 20% dengan harga Rp. 400.000/bln',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
    return queryInterface.bulkInsert('subscriptions', compose);
  },

  down: (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.bulkDelete('Person', null, {});
    */
    return queryInterface.bulkDelete('subscriptions', null, {});
  }
};

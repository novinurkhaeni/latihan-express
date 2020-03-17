'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const date = new Date();
    const packages = [
      {
        name: 'Atenda Sakti',
        price: 149000,
        icon: null,
        type: 1,
        ability: [
          { name: 'Karyawan Tak Terbatas', ability: 'UNLIMITED_EMPLOYEE' },
          { name: 'Tambah Lokasi', ability: 'ADD_LOCATION' }
        ]
      },
      {
        name: 'Pengajuan Izin & Cuti',
        price: 29000,
        icon: 'leaveSubmission',
        type: 2,
        ability: [{ name: 'Pengajuan Izin & Cuti', ability: 'LEAVE_SUBMISSION' }]
      },
      {
        name: 'Selfie Absensi',
        price: 29000,
        icon: 'selfie',
        type: 2,
        ability: [{ name: 'Selfie Absensi', ability: 'SELFIE_PRESENCE' }]
      },
      {
        name: 'Export Laporan Excel',
        price: 29000,
        icon: 'excel',
        type: 2,
        ability: [{ name: 'Export Laporan Excel', ability: 'EXPORT_EXCEL' }]
      },
      {
        name: 'Manajer, Supervisor',
        price: 29000,
        icon: 'manWithGear',
        type: 2,
        ability: [{ name: 'Manajer, Supervisor', ability: 'MANAGER_SUPERVISOR' }]
      },
      {
        name: 'Pengajuan Jadwal Kerja',
        price: 49000,
        icon: 'schedule',
        type: 2,
        ability: [{ name: 'Pengajuan Jadwal Kerja', ability: 'SCHEDULE_SUBMISSION' }]
      },
      {
        name: 'Potongan Gaji Berkala',
        price: 49000,
        icon: 'walletActive',
        type: 2,
        ability: [{ name: 'Potongan Gaji Berkala', ability: 'PERIODIC_DEDUCTION' }]
      },
      {
        name: 'Divisi',
        price: 79000,
        icon: 'division',
        type: 2,
        ability: [{ name: 'Divisi', ability: 'DIVISION' }]
      },
      {
        name: 'HRD',
        price: 79000,
        icon: 'hrd',
        type: 2,
        ability: [{ name: 'HRD', ability: 'HRD' }]
      },
      {
        name: 'BPJS & PPh21',
        price: 79000,
        icon: 'heart',
        type: 2,
        ability: [{ name: 'BPJS & PPh21', ability: 'BPJS_PPH21' }]
      }
    ];

    for (const data of packages) {
      const packageId = await queryInterface.bulkInsert('packages', [
        {
          name: data.name,
          price: data.price,
          icon: data.icon,
          type: data.type,
          created_at: date,
          updated_at: date
        }
      ]);
      const packageDetail = [];
      for (const detail of data.ability) {
        packageDetail.push({
          package_id: packageId,
          name: detail.name,
          ability: detail.ability,
          created_at: date,
          updated_at: date
        });
      }
      await queryInterface.bulkInsert('package_details', packageDetail);
    }
    return;
  },

  down: (queryInterface, Sequelize) => {
    queryInterface.bulkDelete('package_details', null, {}).then;
    queryInterface.bulkDelete('packages', null, {});
    return;
  }
};

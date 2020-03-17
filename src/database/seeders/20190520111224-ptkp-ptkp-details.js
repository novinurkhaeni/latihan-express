'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const date = new Date();
    const ptkpArray = [
      {
        name: 'Laki-Laki Lajang',
        details: [
          {
            name: 'TK/0',
            amount: 54000000
          },
          {
            name: 'TK/1',
            amount: 58500000
          },
          {
            name: 'TK/2',
            amount: 63000000
          },
          {
            name: 'TK/3',
            amount: 67500000
          }
        ]
      },
      {
        name: 'Perempuan Lajang',
        details: [
          {
            name: 'TK/0',
            amount: 54000000
          },
          {
            name: 'TK/1',
            amount: 58500000
          },
          {
            name: 'TK/2',
            amount: 63000000
          },
          {
            name: 'TK/3',
            amount: 67500000
          }
        ]
      },
      {
        name: 'Laki-Laki Kawin',
        details: [
          {
            name: 'K/0',
            amount: 58500000
          },
          {
            name: 'K/1',
            amount: 63000000
          },
          {
            name: 'K/2',
            amount: 67500000
          },
          {
            name: 'K/3',
            amount: 72000000
          }
        ]
      },
      {
        name: 'Suami & Istri Digabung',
        details: [
          {
            name: 'K/I/0',
            amount: 112500000
          },
          {
            name: 'K/I/1',
            amount: 117000000
          },
          {
            name: 'K/I/2',
            amount: 121500000
          },
          {
            name: 'K/I/3',
            amount: 126000000
          }
        ]
      }
    ];

    for (let i = 0; i < ptkpArray.length; i++) {
      const ptkp = {
        name: ptkpArray[i].name,
        created_at: date,
        updated_at: date
      };
      const ptkpId = await queryInterface.bulkInsert('ptkp', [ptkp]);
      const ptkpDetails = [];
      for (const detail of ptkpArray[i].details) {
        const payload = {
          ptkp_id: ptkpId,
          name: detail.name,
          amount: detail.amount,
          created_at: date,
          updated_at: date
        };
        ptkpDetails.push(payload);
      }
      await queryInterface.bulkInsert('ptkp_details', ptkpDetails);
    }
    return;
  },

  down: (queryInterface, Sequelize) => {
    queryInterface.bulkDelete('ptkp_details', null, {});
    queryInterface.bulkDelete('ptkp', null, {});
    return;
  }
};

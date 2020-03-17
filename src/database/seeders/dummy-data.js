'use strict';
const crypt = require('bcrypt');

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
    const date = new Date();
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot run seeder in production');
    }
    if (process.env.SERVER_DOMAIN === 'api.atenda.id') {
      throw new Error('Cannot run dummy-data seeder in production');
    }
    return queryInterface
      .bulkInsert('users', [
        {
          full_name: 'refactory',
          email: 'test@refactory.id',
          password: crypt.hashSync('Sup3rs3cr3t', 15),
          birthday: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
          phone: '082221149696',
          hash: crypt.hashSync(date.toString() + 'test@refactory.id', 10),
          is_active_notif: 1,
          is_phone_confirmed: 1,
          registration_complete: 1,
          created_at: date,
          updated_at: date
        },
        {
          full_name: 'refactory member',
          email: 'member@refactory.id',
          password: crypt.hashSync('Sup3rs3cr3t', 15),
          birthday: `${date.getFullYear() - 21}-${date.getMonth() + 1}-${date.getDate()}`,
          phone: '089686745353',
          hash: crypt.hashSync(date.toString() + 'member@refactory.id', 10),
          is_active_notif: 1,
          is_phone_confirmed: 1,
          registration_complete: 1,
          created_at: date,
          updated_at: date
        },
        {
          full_name: 'another company boss',
          email: 'manager@company.com',
          password: crypt.hashSync('Sup3rs3cr3t', 15),
          birthday: `${date.getFullYear() - 21}-${date.getMonth() + 1}-${date.getDate()}`,
          phone: '08212411555',
          hash: crypt.hashSync(date.toString() + 'manager@company.com', 10),
          is_active_notif: 1,
          is_phone_confirmed: 1,
          registration_complete: 1,
          created_at: date,
          updated_at: date
        }
      ])
      .then(
        queryInterface
          .bulkInsert('companies', [
            {
              codename: 'RFCTRY-001',
              name: 'Refactory',
              address: 'Jl. Bausasran No. 37, Yogyakarta',
              phone: '0274218219',
              timezone: 'asia/jakarta',
              location: '-7.7970677, 110.3751686',
              created_at: date,
              updated_at: date
            },
            {
              codename: 'THCMPN-001',
              name: 'The Company',
              address: 'Jl. Maju Bersama, Nusa Tenggara Barat',
              phone: '0874218219',
              timezone: 'asia/makassar',
              location: '-8.5940259, 116.1218736',
              created_at: date,
              updated_at: date
            }
          ])
          .then(
            queryInterface
              .bulkInsert('company_settings', [
                {
                  company_id: 1,
                  notif_presence_overdue: 15,
                  presence_overdue_limit: 15,
                  overwork_limit: 8,
                  notif_overwork: 1,
                  rest_limit: 60,
                  notif_work_schedule: 120,
                  automated_payroll: 1,
                  created_at: date,
                  updated_at: date
                },
                {
                  company_id: 2,
                  notif_presence_overdue: 30,
                  presence_overdue_limit: 30,
                  overwork_limit: 6,
                  notif_overwork: 1,
                  rest_limit: 45,
                  notif_work_schedule: 180,
                  automated_payroll: 1,
                  created_at: date,
                  updated_at: date
                }
              ])
              .then(
                queryInterface.bulkInsert('employees', [
                  {
                    company_id: 1,
                    user_id: 1,
                    role: 1,
                    salary: 12000000,
                    flag: 3,
                    active: 1,
                    created_at: date,
                    updated_at: date
                  },
                  {
                    company_id: 1,
                    user_id: 2,
                    role: 2,
                    salary: 8000000,
                    flag: 3,
                    active: 1,
                    created_at: date,
                    updated_at: date
                  },
                  {
                    company_id: 2,
                    user_id: 3,
                    role: 1,
                    salary: 9000000,
                    flag: 3,
                    active: 1,
                    created_at: date,
                    updated_at: date
                  }
                ])
              )
          )
      );
  },

  down: (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.bulkDelete('Person', null, {});
    */
  }
};

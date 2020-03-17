'use strict';
const crypt = require('bcrypt');

module.exports = {
  up: (queryInterface, Sequelize) => {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.
    */
    const administrator = [
      {
        name: 'Super Admin',
        email: 'idgajiandulu@gmail.com',
        password: 'Sup3rP4ssw0rd',
        roles: 1
      },
      {
        name: 'Customer Service GajianDulu',
        email: 'cs@gajiandulu.id',
        password: 'Sup3rP4ssw0rd',
        roles: 2
      }
      // you can add new admin here
    ];
    const adminBulk = [];
    let admin;
    for (let i = 0; i < administrator.length; i++) {
      admin = {
        full_name: administrator[i].name,
        email: administrator[i].email,
        password: crypt.hashSync(administrator[i].password, 15),
        roles: administrator[i].roles,
        created_at: new Date(),
        updated_at: new Date()
      };
      adminBulk.push(admin);
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot run seeder in production');
    }
    return queryInterface.bulkInsert('admins', adminBulk, {});
  },

  down: (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.
    */
    // Example:
    return queryInterface.bulkDelete('admins', null, {});
  }
};

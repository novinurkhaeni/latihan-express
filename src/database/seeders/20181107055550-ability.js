'use strict';
require('module-alias/register');
const { employees: Employee } = require('@models');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const qualifiedUser = await Employee.findAll({
      attributes: ['id'],
      where: [{ $not: { role: 2 } }, { active: 1 }]
    });

    let bulk = [];
    for (let i = 0; i < qualifiedUser.length; i++) {
      const seed = {
        employee_id: qualifiedUser[i].id,
        created_at: new Date(),
        updated_at: new Date()
      };
      bulk.push(seed);
    }

    return queryInterface.bulkInsert('abilities', bulk, {});
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('abilities', null, {});
  }
};

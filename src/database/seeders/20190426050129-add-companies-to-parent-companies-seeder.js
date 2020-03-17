'use strict';
require('module-alias/register');
const { companies: Company } = require('@models');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    //find all data from companies and input to parent company table
    const dataCompany = await Company.findAll({
      attributes: ['id', 'name']
    });

    for (let i = 0; i < dataCompany.length; i++) {
      const seed = {
        company_name: dataCompany[i].name,
        active: 1,
        created_at: new Date(),
        updated_at: new Date()
      };
      const parentId = await queryInterface.bulkInsert('parent_companies', [seed]);
      await queryInterface.bulkUpdate(
        'companies',
        { parent_company_id: parentId },
        { id: dataCompany[i].id }
      );
    }
    return;
  },

  down: (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.bulkDelete('Person', null, {});
    */
    return queryInterface.bulkDelete('parent_companies', null, {});
  }
};

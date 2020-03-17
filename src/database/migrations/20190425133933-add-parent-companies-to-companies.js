'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
    return queryInterface.addColumn('companies', 'parent_company_id', {
      after: 'id',
      type: Sequelize.INTEGER,
      references: {
        model: 'parent_companies', //source model
        key: 'id' //source key
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  down: (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
    return queryInterface.removeColumn('companies', 'parent_company_id');
  }
};

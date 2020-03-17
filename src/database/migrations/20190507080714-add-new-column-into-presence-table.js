'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
    return queryInterface.addColumn('presences', 'company_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: 'employee_id',
      references: {
        model: 'companies',
        key: 'id'
      }
    });
  },

  down: (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
    return queryInterface.removeColumn('presences', 'company_id', Sequelize.INTEGER);
  }
};

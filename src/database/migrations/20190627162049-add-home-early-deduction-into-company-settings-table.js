'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
    return queryInterface.addColumn('company_settings', 'home_early_deduction', {
      type: Sequelize.INTEGER,
      after: 'late_deduction',
      allowNull: true,
      defaultValue: null
    });
  },

  down: (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
    return queryInterface.removeColumn(
      'company_settings',
      'home_early_deduction',
      Sequelize.INTEGER
    );
  }
};

'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
    return queryInterface
      .addColumn('subscription_details', 'start_period', {
        type: Sequelize.DATEONLY,
        after: 'date_to_deactive',
        defaultValue: null
      })
      .then(() =>
        queryInterface.addColumn('subscription_details', 'end_period', {
          type: Sequelize.DATEONLY,
          after: 'start_period',
          defaultValue: null
        })
      );
  },

  down: (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
    return queryInterface
      .removeColumn('subscription_details', 'start_period', Sequelize.DATEONLY)
      .then(() =>
        queryInterface.removeColumn('subscription_details', 'end_period', Sequelize.DATEONLY)
      );
  }
};

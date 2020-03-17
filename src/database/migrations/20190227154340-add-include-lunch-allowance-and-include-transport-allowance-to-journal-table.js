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
      .addColumn('journals', 'include_lunch_allowance', {
        type: Sequelize.TINYINT,
        after: 'description',
        defaultValue: 0
      })
      .then(() =>
        queryInterface.addColumn('journals', 'include_transport_allowance', {
          type: Sequelize.TINYINT,
          after: 'include_lunch_allowance',
          defaultValue: 0
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
      .removeColumn('journals', 'include_lunch_allowance', Sequelize.TINYINT)
      .then(() =>
        queryInterface.removeColumn('journals', 'include_transport_allowance', Sequelize.TINYINT)
      );
  }
};

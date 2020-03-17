'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface
      .addColumn('presences', 'rest_begin_location', {
        type: Sequelize.STRING,
        after: 'checkout_location',
        allowNull: true
      })
      .then(() =>
        queryInterface.addColumn('presences', 'rest_over_location', {
          type: Sequelize.STRING,
          after: 'rest_begin_location',
          allowNull: true
        })
      );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface
      .removeColumn('presences', 'rest_begin_location', Sequelize.STRING)
      .then(() => queryInterface.removeColumn('presences', 'rest_over_location', Sequelize.STRING));
  }
};

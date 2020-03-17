'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('presences', 'custom_presence', {
      type: Sequelize.TINYINT,
      after: 'checkout_location',
      allowNull: true,
      defaultValue: 0
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('presences', 'custom_presence', Sequelize.TINYINT);
  }
};

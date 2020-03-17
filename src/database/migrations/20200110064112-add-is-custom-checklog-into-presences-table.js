'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('presences', 'is_custom_presence', {
      allowNull: true,
      type: Sequelize.TINYINT,
      defaultValue: 0,
      after: 'is_permit'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('presences', 'is_custom_presence', Sequelize.TINYINT);
  }
};

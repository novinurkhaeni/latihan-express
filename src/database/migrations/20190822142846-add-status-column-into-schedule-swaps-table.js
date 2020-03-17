'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('schedule_swaps', 'status', {
      type: Sequelize.TINYINT,
      after: 'description',
      allowNull: true,
      defaultValue: 0
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('schedule_swaps', 'status', Sequelize.TINYINT);
  }
};

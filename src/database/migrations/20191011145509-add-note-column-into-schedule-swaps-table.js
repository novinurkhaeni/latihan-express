'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('schedule_swaps', 'note', {
      type: Sequelize.STRING,
      after: 'description',
      allowNull: true,
      defaultValue: null
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('schedule_swaps', 'note', Sequelize.STRING);
  }
};

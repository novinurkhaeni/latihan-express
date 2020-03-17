'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('defined_schedules', 'status', {
      type: Sequelize.TINYINT,
      after: 'presence_end',
      allowNull: true,
      defaultValue: 0
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('defined_schedules', 'status', Sequelize.TINYINT);
  }
};

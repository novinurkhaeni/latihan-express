'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('employees', 'leave', {
      type: Sequelize.INTEGER,
      after: 'gajiandulu_status',
      allowNull: true,
      defaultValue: 0
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('employees', 'leave', Sequelize.INTEGER);
  }
};

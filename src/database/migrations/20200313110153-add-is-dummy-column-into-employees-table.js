'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('employees', 'is_dummy', {
      allowNull: true,
      type: Sequelize.TINYINT,
      after: 'leave',
      defaultValue: 0
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('employees', 'is_dummy', Sequelize.TINYINT);
  }
};

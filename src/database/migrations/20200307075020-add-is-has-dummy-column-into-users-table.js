'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('users', 'is_has_dummy', {
      allowNull: true,
      type: Sequelize.TINYINT,
      after: 'demo_account',
      defaultValue: 1
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('users', 'is_has_dummy', Sequelize.TINYINT);
  }
};

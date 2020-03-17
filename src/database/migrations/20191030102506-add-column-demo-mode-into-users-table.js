'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('users', 'demo_mode', {
      type: Sequelize.TINYINT,
      after: 'login_attempt',
      allowNull: true,
      defaultValue: 1
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('users', 'demo_mode', Sequelize.TINYINT);
  }
};

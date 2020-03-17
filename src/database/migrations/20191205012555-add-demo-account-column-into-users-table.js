'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('users', 'demo_account', {
      allowNull: true,
      type: Sequelize.TINYINT,
      defaultValue: 0,
      after: 'demo_step'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('users', 'demo_account', Sequelize.TINYINT);
  }
};

'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('users', 'demo_step', {
      type: Sequelize.INTEGER,
      after: 'demo_mode',
      allowNull: true,
      defaultValue: null
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('users', 'demo_step', Sequelize.INTEGER);
  }
};

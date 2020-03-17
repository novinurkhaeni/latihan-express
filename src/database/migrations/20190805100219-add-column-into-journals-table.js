'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('journals', 'on_hold', {
      type: Sequelize.TINYINT,
      after: 'balance',
      allowNull: true,
      defaultValue: 0
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('journals', 'on_hold', Sequelize.TINYINT);
  }
};

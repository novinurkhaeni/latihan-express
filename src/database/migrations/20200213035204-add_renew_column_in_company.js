'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('companies', 'renew', {
      allowNull: true,
      type: Sequelize.TINYINT,
      after: 'registration_complete',
      defaultValue: 0
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('companies', 'renew', Sequelize.TINYINT);
  }
};

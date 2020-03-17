'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('company_settings', 'selfie_checklog', {
      allowNull: true,
      type: Sequelize.TINYINT,
      defaultValue: 1,
      after: 'leave_quota'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('company_settings', 'selfie_checklog', Sequelize.TINYINT);
  }
};

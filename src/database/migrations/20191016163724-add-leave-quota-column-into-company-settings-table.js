'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('company_settings', 'leave_quota', {
      type: Sequelize.INTEGER,
      after: 'home_early_deduction',
      allowNull: true,
      defaultValue: null
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('company_settings', 'leave_quota', Sequelize.INTEGER);
  }
};

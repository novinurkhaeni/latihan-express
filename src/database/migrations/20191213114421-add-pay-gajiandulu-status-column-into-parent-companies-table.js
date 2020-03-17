'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('parent_companies', 'pay_gajiandulu_status', {
      allowNull: true,
      type: Sequelize.TINYINT,
      defaultValue: 1,
      after: 'active'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'parent_companies',
      'pay_gajiandulu_status',
      Sequelize.TINYINT
    );
  }
};

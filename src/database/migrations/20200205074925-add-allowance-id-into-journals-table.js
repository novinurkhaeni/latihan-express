'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('journals', 'allowance_id', {
      allowNull: true,
      type: Sequelize.INTEGER,
      after: 'salary_groups_id',
      foreignKey: true,
      references: {
        model: 'allowances',
        key: 'id'
      },
      onDelete: 'SET NULL'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('journals', 'allowance_id', Sequelize.INTEGER);
  }
};

'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('journals', 'salary_groups_id', {
      allowNull: true,
      type: Sequelize.INTEGER,
      after: 'company_id',
      foreignKey: true,
      references: {
        model: 'salary_groups',
        key: 'id'
      },
      onDelete: 'SET NULL'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('journals', 'salary_groups_id', Sequelize.INTEGER);
  }
};

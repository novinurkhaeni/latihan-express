'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('schedule_shifts', 'salary_group_id', {
      type: Sequelize.INTEGER,
      after: 'company_id',
      foreignKey: true,
      allowNull: true,
      defaultValue: null,
      references: {
        model: 'salary_groups',
        key: 'id'
      },
      onDelete: 'cascade'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('schedule_shifts', 'salary_group_id', Sequelize.INTEGER);
  }
};

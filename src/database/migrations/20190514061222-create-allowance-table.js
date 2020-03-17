'use strict';

module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('allowances', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      salary_groups_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'salary_groups',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      name: {
        type: Sequelize.STRING
      },
      type: {
        type: Sequelize.TINYINT
      },
      amount: {
        type: Sequelize.INTEGER
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    }),

  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('allowances');
  }
};

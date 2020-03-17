'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('employees', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      company_id: {
        allowNull: false,
        foreignKey: true,
        type: Sequelize.INTEGER,
        references: {
          model: 'companies',
          key: 'id'
        }
      },
      user_id: {
        allowNull: false,
        foreignKey: true,
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      role: {
        allowNull: false,
        type: Sequelize.INTEGER(11)
      },
      salary: {
        allowNull: true,
        type: Sequelize.INTEGER
      },
      meal_allowance: {
        allowNull: true,
        type: Sequelize.INTEGER
      },
      workdays: {
        allowNull: true,
        type: Sequelize.INTEGER
      },
      daily_salary: {
        allowNull: true,
        type: Sequelize.INTEGER
      },
      daily_salary_with_meal: {
        allowNull: true,
        type: Sequelize.INTEGER
      },
      flag: {
        allowNull: false,
        type: Sequelize.INTEGER(11)
      },
      active: {
        allowNull: false,
        type: Sequelize.TINYINT,
        defaultValue: 1
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('employees');
  }
};

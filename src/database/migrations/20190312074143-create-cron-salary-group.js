'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('cron_salary_groups', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      company_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        foreignKey: true,
        references: {
          model: 'companies',
          key: 'id'
        }
      },
      salary_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        foreignKey: true,
        references: {
          model: 'salary_groups',
          key: 'id'
        }
      },
      salary_type: {
        type: Sequelize.INTEGER
      },
      salary: {
        type: Sequelize.INTEGER
      },
      transport_allowance: {
        type: Sequelize.INTEGER
      },
      lunch_allowance: {
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
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('cron_salary_groups');
  }
};

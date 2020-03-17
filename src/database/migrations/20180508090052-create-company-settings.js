'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('company_settings', {
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
        },
        onDelete: 'cascade'
      },
      notif_presence_overdue: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      presence_overdue_limit: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      overwork_limit: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      notif_overwork: {
        allowNull: false,
        type: Sequelize.BOOLEAN
      },
      rest_limit: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      notif_work_schedule: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      automated_payroll: {
        allowNull: false,
        type: Sequelize.BOOLEAN
      },
      payroll_date: {
        allowNull: true,
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
    return queryInterface.dropTable('company_settings');
  }
};

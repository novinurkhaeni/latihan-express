'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('schedule_templates', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      employee_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        foreignKey: true,
        references: {
          model: 'employees',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      start_date: {
        type: Sequelize.DATEONLY
      },
      end_date: {
        type: Sequelize.DATEONLY
      },
      start_time: {
        type: Sequelize.TIME
      },
      end_time: {
        type: Sequelize.TIME
      },
      repeat_type: {
        type: Sequelize.STRING
      },
      daily_frequent: {
        type: Sequelize.INTEGER
      },
      weekly_frequent: {
        type: Sequelize.INTEGER
      },
      weekly_frequent_days: {
        type: Sequelize.STRING
      },
      monthly_frequent: {
        type: Sequelize.INTEGER
      },
      monthly_frequent_date: {
        type: Sequelize.STRING
      },
      monthly_frequent_custom_count: {
        type: Sequelize.STRING
      },
      monthly_frequent_custom_days: {
        type: Sequelize.STRING
      },
      yearly_frequent: {
        type: Sequelize.STRING
      },
      yearly_frequent_months: {
        type: Sequelize.STRING
      },
      yearly_frequent_custom_count: {
        type: Sequelize.STRING
      },
      yearly_frequent_custom_days: {
        type: Sequelize.STRING
      },
      deleted_date: {
        type: Sequelize.STRING
      },
      deleted_after: {
        type: Sequelize.DATEONLY
      },
      end_repeat: {
        type: Sequelize.DATEONLY
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
    return queryInterface.dropTable('schedule_templates');
  }
};

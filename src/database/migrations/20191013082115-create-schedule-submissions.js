'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('schedule_submissions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      employee_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'employees',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      defined_schedule_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'defined_schedules',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      type: {
        type: Sequelize.TINYINT,
        allowNull: false
      },
      status: {
        type: Sequelize.TINYINT,
        allowNull: false
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
    return queryInterface.dropTable('schedule_submissions');
  }
};

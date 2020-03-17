'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('presences', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      employee_id: {
        allowNull: true,
        foreignKey: true,
        type: Sequelize.INTEGER,
        references: {
          model: 'employees',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      presence_date: {
        allowNull: false,
        type: Sequelize.DATEONLY
      },
      presence_start: {
        allowNull: true,
        type: Sequelize.DATE
      },
      presence_end: {
        allowNull: true,
        type: Sequelize.DATE
      },
      rest_start: {
        allowNull: true,
        type: Sequelize.DATE
      },
      rest_end: {
        allowNull: true,
        type: Sequelize.DATE
      },
      presence_overdue: {
        allowNull: true,
        type: Sequelize.INTEGER
      },
      rest_overdue: {
        allowNull: true,
        type: Sequelize.INTEGER
      },
      is_absence: {
        allowNull: false,
        type: Sequelize.TINYINT,
        defaultValue: 0
      },
      is_leave: {
        allowNull: false,
        type: Sequelize.TINYINT,
        defaultValue: 0
      },
      overwork: {
        allowNull: true,
        type: Sequelize.INTEGER
      },
      work_hours: {
        allowNull: true,
        type: Sequelize.INTEGER
      },
      checkin_location: {
        allowNull: true,
        type: Sequelize.STRING
      },
      checkout_location: {
        allowNull: true,
        type: Sequelize.STRING
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
    return queryInterface.dropTable('presences');
  }
};

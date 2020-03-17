'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('schedule_swap_details', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      schedule_swap_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'schedule_swaps',
          key: 'id'
        }
      },
      schedule_id: {
        type: Sequelize.INTEGER,
        foreignKey: true,
        allowNull: false,
        references: {
          model: 'defined_schedules',
          key: 'id'
        }
      },
      type: {
        type: Sequelize.TINYINT
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
    return queryInterface.dropTable('schedule_swap_details');
  }
};

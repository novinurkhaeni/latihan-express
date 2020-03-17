'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('submissions', {
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
      type: {
        allowNull: false,
        type: Sequelize.TINYINT
      },
      presence_type: {
        allowNull: true,
        type: Sequelize.TINYINT
      },
      start_date: {
        allowNull: true,
        type: Sequelize.STRING
      },
      end_date: {
        allowNull: true,
        type: Sequelize.STRING
      },
      note: {
        allowNull: true,
        type: Sequelize.STRING
      },
      amount: {
        allowNull: true,
        type: Sequelize.INTEGER
      },
      status: {
        allowNull: false,
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
    return queryInterface.dropTable('submissions');
  }
};

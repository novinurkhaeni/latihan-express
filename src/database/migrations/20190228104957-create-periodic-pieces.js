'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('periodic_pieces', {
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
        type: Sequelize.TINYINT,
        allowNull: false
      },
      note: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
      },
      repeat_type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      start: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      end: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      amount: {
        type: Sequelize.INTEGER,
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
    return queryInterface.dropTable('periodic_pieces');
  }
};

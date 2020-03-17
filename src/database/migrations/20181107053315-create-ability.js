'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('abilities', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      employee_id: {
        allowNull: false,
        foreignKey: true,
        type: Sequelize.INTEGER,
        references: {
          model: 'employees',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      type: {
        allowNull: true,
        type: Sequelize.TINYINT,
        defaultValue: 0
      },
      ability: {
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
    return queryInterface.dropTable('abilities');
  }
};

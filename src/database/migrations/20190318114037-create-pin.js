'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('pins', {
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
      pin: {
        type: Sequelize.STRING,
        allowNull: false
      },
      use_fingerprint: {
        type: Sequelize.TINYINT,
        allowNull: true,
        defaultValue: 0
      },
      apple_biometric: {
        type: Sequelize.TINYINT,
        allowNull: true,
        defaultValue: 0
      },
      sensor_type: {
        type: Sequelize.STRING,
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
    return queryInterface.dropTable('pins');
  }
};

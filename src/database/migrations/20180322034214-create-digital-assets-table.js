'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('digital_assets', {
      id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      path: {
        allowNull: false,
        type: Sequelize.STRING
      },
      filename: {
        allowNull: false,
        type: Sequelize.STRING
      },
      url: {
        allowNull: false,
        type: Sequelize.STRING
      },
      mime_type: {
        allowNull: true,
        type: Sequelize.STRING
      },
      is_verified: {
        allowNull: false,
        type: Sequelize.TINYINT,
        defaultValue: 0
      },
      type: {
        allowNull: false,
        type: Sequelize.STRING(45)
      },
      uploadable_type: {
        allowNull: false,
        type: Sequelize.STRING
      },
      uploadable_id: {
        allowNull: false,
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
    return queryInterface.dropTable('digital_assets');
  }
};

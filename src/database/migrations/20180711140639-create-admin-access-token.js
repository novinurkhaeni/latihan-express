'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('admin_access_tokens', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      admin_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        foreignKey: true,
        references: {
          model: 'admins',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      access_token: {
        allowNull: false,
        type: Sequelize.TEXT
      },
      refresh_token: {
        allowNull: false,
        type: Sequelize.STRING
      },
      expiry_in: {
        type: Sequelize.INTEGER
      },
      client_id: {
        type: Sequelize.STRING
      },
      client_secret: {
        type: Sequelize.STRING
      },
      user_agent: {
        type: Sequelize.STRING
      },
      provider: {
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
    return queryInterface.dropTable('admin_access_tokens');
  }
};

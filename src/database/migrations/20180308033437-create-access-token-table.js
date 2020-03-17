'use strict';

module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('access_tokens', {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: Sequelize.INTEGER
      },
      user_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        foreignKey: true,
        references: {
          model: 'users',
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
        allowNull: true,
        type: Sequelize.INTEGER
      },
      client_id: {
        allowNull: true,
        type: Sequelize.STRING
      },
      client_secret: {
        allowNull: true,
        type: Sequelize.STRING
      },
      provider: {
        allowNull: false,
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
    }),

  down: (queryInterface, Sequelize) => queryInterface.dropTable('access_tokens')
};

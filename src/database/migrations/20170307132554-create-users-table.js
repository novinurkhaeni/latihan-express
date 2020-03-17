'use strict';

module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      full_name: {
        allowNull: false,
        type: Sequelize.STRING
      },
      email: {
        allowNull: false,
        type: Sequelize.STRING,
        unique: true
      },
      password: {
        allowNull: true,
        type: Sequelize.STRING
      },
      birthday: {
        allowNull: true,
        type: Sequelize.DATEONLY
      },
      phone: {
        allowNull: true,
        type: Sequelize.STRING,
        unique: true
      },
      hash: {
        allowNull: false,
        type: Sequelize.STRING,
        unique: true
      },
      is_active_notif: {
        allowNull: true,
        type: Sequelize.TINYINT,
        defaultValue: 0
      },
      is_phone_confirmed: {
        allowNull: true,
        type: Sequelize.TINYINT,
        defaultValue: 0
      },
      currency: {
        allowNull: true,
        type: Sequelize.STRING(45),
        defaultValue: 'IDR'
      },
      registration_complete: {
        allowNull: true,
        type: Sequelize.TINYINT,
        defaultValue: 0
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

  down: queryInterface => queryInterface.dropTable('users')
};

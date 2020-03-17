'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('companies', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      codename: {
        allowNull: false,
        type: Sequelize.STRING(45)
      },
      company_name: {
        allowNull: true,
        type: Sequelize.STRING
      },
      name: {
        allowNull: false,
        type: Sequelize.STRING
      },
      unique_id: {
        allowNull: false,
        type: Sequelize.STRING
      },
      address: {
        allowNull: false,
        type: Sequelize.TEXT
      },
      phone: {
        allowNull: false,
        type: Sequelize.STRING(45)
      },
      timezone: {
        allowNull: false,
        type: Sequelize.STRING(45)
      },
      location: {
        allowNull: false,
        type: Sequelize.STRING
      },
      active: {
        allowNull: false,
        type: Sequelize.TINYINT,
        defaultValue: 0
      },
      registration_complete: {
        allowNull: true,
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
    return queryInterface.dropTable('companies');
  }
};

'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('gajiandulu_data', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      bank_owner: {
        type: Sequelize.STRING
      },
      bank_name: {
        type: Sequelize.INTEGER
      },
      account_number: {
        type: Sequelize.STRING
      },
      bank_branch: {
        type: Sequelize.STRING
      },
      type: {
        type: Sequelize.INTEGER
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true
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
    return queryInterface.dropTable('gajiandulu_data');
  }
};

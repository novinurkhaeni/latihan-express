'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('abilities_categories', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'companies',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      role: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      ability: {
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
    return queryInterface.dropTable('abilities_categories');
  }
};

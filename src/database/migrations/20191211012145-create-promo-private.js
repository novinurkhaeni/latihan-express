'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('promo_privates', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      parent_company_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        foreignKey: true,
        references: {
          model: 'parent_companies',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      promo_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        foreignKey: true,
        references: {
          model: 'promos',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      usage: {
        allowNull: true,
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      expired_at: {
        allowNull: false,
        type: Sequelize.DATEONLY
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
    return queryInterface.dropTable('promo_privates');
  }
};

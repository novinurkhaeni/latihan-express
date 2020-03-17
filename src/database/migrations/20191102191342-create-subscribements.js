'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('subscribements', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'companies',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      package_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'packages',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      transaction_id: {
        type: Sequelize.STRING(6),
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'transactions',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      date_to_active: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
      },
      date_to_deactive: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
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
    return queryInterface.dropTable('subscribements');
  }
};

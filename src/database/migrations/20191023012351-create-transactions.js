'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('transactions', {
      id: {
        primaryKey: true,
        allowNull: true,
        type: Sequelize.STRING(6)
      },
      employee_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        foreignKey: true,
        references: {
          model: 'employees',
          key: 'id'
        },
        onDelete: 'cascade'
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
      request_id: {
        type: Sequelize.STRING(30),
        allowNull: true,
        defaultValue: null
      },
      company_code: {
        type: Sequelize.STRING(5),
        allowNull: true,
        defaultValue: null
      },
      channel_type: {
        type: Sequelize.STRING(4),
        allowNull: true,
        defaultValue: null
      },
      paid_amount: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null
      },
      total_amount: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      sub_company: {
        type: Sequelize.STRING(5),
        allowNull: true,
        defaultValue: null
      },
      id_description: {
        type: Sequelize.STRING,
        allowNull: false
      },
      en_description: {
        type: Sequelize.STRING,
        allowNull: false
      },
      payment_status: {
        type: Sequelize.STRING(2),
        allowNull: false
      },
      type: {
        type: Sequelize.TINYINT,
        allowNull: false
      },
      payment_method: {
        type: Sequelize.STRING(10),
        allowNull: false
      },
      url: {
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
    return queryInterface.dropTable('transactions');
  }
};

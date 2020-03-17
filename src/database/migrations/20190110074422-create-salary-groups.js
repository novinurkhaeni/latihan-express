'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('salary_groups', {
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
      salary_name: {
        type: Sequelize.STRING
      },
      salary_type: {
        type: Sequelize.STRING
      },
      salary: {
        type: Sequelize.INTEGER
      },
      transport_allowance: {
        type: Sequelize.INTEGER
      },
      lunch_allowance: {
        type: Sequelize.INTEGER
      },
      bpjs_allowance: {
        type: Sequelize.INTEGER
      },
      jkk_allowance: {
        type: Sequelize.INTEGER
      },
      jkm_allowance: {
        type: Sequelize.INTEGER
      },
      jht_allowance: {
        type: Sequelize.INTEGER
      },
      jkk_reduction: {
        type: Sequelize.INTEGER
      },
      jkm_reduction: {
        type: Sequelize.INTEGER
      },
      jht_reduction: {
        type: Sequelize.INTEGER
      },
      tax_reduction: {
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
    return queryInterface.dropTable('salary-groups');
  }
};

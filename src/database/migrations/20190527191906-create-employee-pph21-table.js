'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('employee_pph21s', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      employee_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        foreignKey: true,
        references: {
          model: 'employees',
          key: 'id'
        }
      },
      ptkp_detail_id: {
        allowNull: false,
        foreignKey: true,
        type: Sequelize.INTEGER,
        references: {
          model: 'ptkp_details',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      position_allowance: {
        allowNull: false,
        type: Sequelize.TINYINT
      },
      npwp: {
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
    });
  },

  down: queryInterface => queryInterface.dropTable('employee_pph21s')
};

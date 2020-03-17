'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('employee_notes', 'amount', {
      type: Sequelize.INTEGER,
      after: 'notes',
      allowNull: true,
      defaultValue: null
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('employee_notes', 'amount', Sequelize.INTEGER);
  }
};

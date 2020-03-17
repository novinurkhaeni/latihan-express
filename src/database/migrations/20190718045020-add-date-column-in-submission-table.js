'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('submissions', 'date', {
      type: Sequelize.STRING,
      after: 'employee_id',
      allowNull: true
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('submissions', 'date', Sequelize.STRING);
  }
};

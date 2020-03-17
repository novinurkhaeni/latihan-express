'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('employees', 'date_end_work', {
      type: Sequelize.STRING,
      after: 'date_start_work',
      allowNull: true,
      defaultValue: null
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('employees', 'date_end_work', Sequelize.STRING);
  }
};

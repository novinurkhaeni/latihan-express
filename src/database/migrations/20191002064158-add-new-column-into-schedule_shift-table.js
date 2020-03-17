'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface
      .addColumn('schedule_shifts', 'color', {
        type: Sequelize.STRING,
        after: 'is_deleted',
        allowNull: true,
        defaultValue: null
      })
      .then(() =>
        queryInterface.addColumn('schedule_shifts', 'use_salary_per_shift', {
          type: Sequelize.TINYINT,
          after: 'color',
          allowNull: true,
          defaultValue: null
        })
      );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface
      .removeColumn('schedule_shifts', 'color', Sequelize.STRING)
      .then(() =>
        queryInterface.removeColumn('schedule_shifts', 'use_salary_per_shift', Sequelize.TINYINT)
      );
  }
};

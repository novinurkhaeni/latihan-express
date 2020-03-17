'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
    return queryInterface
      .addColumn('employees', 'gajiandulu_status', {
        type: Sequelize.TINYINT,
        after: 'salary_type',
        defaultValue: 1
      })
      .then(() =>
        queryInterface.addColumn('employees', 'date_start_work', {
          type: Sequelize.DATEONLY,
          after: 'gajiandulu_status',
          defaultValue: null
        })
      );
  },

  down: (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
    return queryInterface
      .removeColumn('employees', 'gajiandulu_status', Sequelize.TINYINT)
      .then(() => queryInterface.removeColumn('employees', 'date_start_work', Sequelize.DATEONLY));
  }
};

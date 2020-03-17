'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
    return queryInterface.sequelize
      .query('ALTER TABLE cron_salary_groups DROP FOREIGN KEY cron_salary_groups_ibfk_2;')
      .then(() =>
        queryInterface.sequelize.query(
          'ALTER TABLE cron_salary_groups ADD CONSTRAINT cron_salary_groups_ibfk_2 FOREIGN KEY (salary_id) REFERENCES salary_groups (id) ON DELETE CASCADE;'
        )
      );
  },

  down: (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
    return queryInterface.sequelize
      .query('ALTER TABLE cron_salary_groups DROP FOREIGN KEY cron_salary_groups_ibfk_2;')
      .then(() =>
        queryInterface.sequelize.query(
          'ALTER TABLE cron_salary_groups ADD CONSTRAINT cron_salary_groups_ibfk_2 FOREIGN KEY (salary_id) REFERENCES salary_groups (id) ON DELETE RESTRICT;'
        )
      );
  }
};

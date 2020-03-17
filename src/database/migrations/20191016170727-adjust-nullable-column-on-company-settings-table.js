'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize
      .query('ALTER TABLE company_settings MODIFY COLUMN overwork_limit INTEGER NULL;')
      .then(() =>
        queryInterface.sequelize.query(
          'ALTER TABLE company_settings MODIFY COLUMN late_deduction INTEGER NULL;'
        )
      );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(
      'ALTER TABLE company_settings MODIFY COLUMN overwork_limit INTEGER NOT_NULL;'
    );
  }
};

'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(
      'ALTER TABLE bank_data MODIFY COLUMN bank_branch VARCHAR(255) NULL;'
    );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(
      'ALTER TABLE bank_data MODIFY COLUMN bank_branch VARCHAR(255) NOT NULL;'
    );
  }
};

'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(
      'ALTER TABLE digital_assets MODIFY COLUMN path VARCHAR(255) NULL, MODIFY COLUMN filename VARCHAR(255) NULL;'
    );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(
      'ALTER TABLE digital_assets MODIFY COLUMN path VARCHAR(255) NOT NULL, MODIFY COLUMN filename VARCHAR(255) NOT NULL;'
    );
  }
};

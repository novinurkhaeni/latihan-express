'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(
      'ALTER TABLE digital_assets MODIFY COLUMN url VARCHAR(700) NULL;'
    );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(
      'ALTER TABLE digital_assets MODIFY COLUMN url VARCHAR(255) NULL;'
    );
  }
};

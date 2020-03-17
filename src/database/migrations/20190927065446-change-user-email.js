'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(
      'ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL;'
    );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(
      'ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NOT NULL;'
    );
  }
};

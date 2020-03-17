'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query('ALTER TABLE users MODIFY COLUMN hash VARCHAR(255);');
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(
      'ALTER TABLE users MODIFY COLUMN hash VARCHAR(255) NOT NULL;'
    );
  }
};

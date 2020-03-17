'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(
      'ALTER TABLE companies MODIFY COLUMN phone VARCHAR(45) NULL;'
    );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(
      'ALTER TABLE companies MODIFY COLUMN phone VARCHAR(45) NOT NULL;'
    );
  }
};

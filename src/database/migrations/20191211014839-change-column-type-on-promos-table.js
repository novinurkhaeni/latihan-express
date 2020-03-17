'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(
      'ALTER TABLE promos MODIFY COLUMN expired_date DATE NULL;'
    );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(
      'ALTER TABLE promos MODIFY COLUMN expired_date INTEGER(11) NULL;'
    );
  }
};

'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query('ALTER TABLE abilities_categories MODIFY ability TEXT;');
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(
      'ALTER TABLE abilities_categories MODIFY ability VARCHAR(255);'
    );
  }
};

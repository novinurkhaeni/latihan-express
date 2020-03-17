'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface
      .addColumn('journal_details', 'bank_name', {
        type: Sequelize.STRING,
        after: 'status',
        allowNull: true,
        defaultValue: null
      })
      .then(() =>
        queryInterface.addColumn('journal_details', 'account_number', {
          type: Sequelize.STRING,
          after: 'bank_name',
          allowNull: true,
          defaultValue: null
        })
      );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface
      .removeColumn('journal_details', 'bank_name', Sequelize.STRING)
      .then(() =>
        queryInterface.removeColumn('journal_details', 'account_number', Sequelize.STRING)
      );
  }
};

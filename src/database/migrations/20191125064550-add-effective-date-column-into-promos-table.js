'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface
      .addColumn('promos', 'effective_date', {
        type: Sequelize.DATEONLY,
        after: 'amount',
        allowNull: true,
        defaultValue: null
      })
      .then(() => {
        queryInterface.addColumn('promos', 'visibility', {
          type: Sequelize.STRING,
          after: 'amount',
          allowNull: true,
          defaultValue: null
        });
      });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('promos', 'effective_date', Sequelize.DATE).then(() => {
      queryInterface.removeColumn('promos', 'visibility', Sequelize.DATE);
    });
  }
};

'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface
      .addColumn('schedule_swaps', 'self_id', {
        type: Sequelize.INTEGER,
        after: 'status',
        allowNull: true,
        defaultValue: null
      })
      .then(() =>
        queryInterface.addColumn('schedule_swaps', 'away_id', {
          type: Sequelize.INTEGER,
          after: 'self_id',
          allowNull: true,
          defaultValue: null
        })
      );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface
      .removeColumn('schedule_swaps', 'self_id', Sequelize.INTEGER)
      .then(() => queryInterface.removeColumn('schedule_swaps', 'away_id', Sequelize.INTEGER));
  }
};

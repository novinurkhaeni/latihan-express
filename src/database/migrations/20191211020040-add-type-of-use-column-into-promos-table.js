'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('promos', 'type_of_use', {
      allowNull: true,
      type: Sequelize.STRING('15'),
      defaultValue: 'general',
      after: 'usage'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('promos', 'type_of_use', Sequelize.STRING('15'));
  }
};

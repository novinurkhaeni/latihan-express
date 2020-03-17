'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('users', 'is_email_confirmed', {
      allowNull: true,
      type: Sequelize.TINYINT,
      after: 'is_phone_confirmed',
      defaultValue: 1
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('users', 'is_email_confirmed', Sequelize.TINYINT);
  }
};

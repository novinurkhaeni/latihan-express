'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('pins', 'user_id', {
      allowNull: true,
      type: Sequelize.INTEGER,
      after: 'employee_id',
      foreignKey: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('pins', 'user_id', Sequelize.INTEGER);
  }
};

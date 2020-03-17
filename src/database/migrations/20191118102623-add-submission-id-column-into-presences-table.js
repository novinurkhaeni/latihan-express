'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('presences', 'submission_id', {
      allowNull: true,
      type: Sequelize.INTEGER,
      after: 'company_id',
      foreignKey: true,
      references: {
        model: 'submissions',
        key: 'id'
      },
      onDelete: 'CASCADE'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('presences', 'submission_id', Sequelize.INTEGER);
  }
};

'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize
      .query('ALTER TABLE pins DROP FOREIGN KEY pins_ibfk_1;')
      .then(() => {
        return queryInterface.sequelize.query('ALTER TABLE pins DROP COLUMN employee_id;');
      });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('pins', 'employee_id', {
      allowNull: true,
      type: Sequelize.INTEGER,
      after: 'id',
      foreignKey: true,
      references: {
        model: 'employees',
        key: 'id'
      },
      onDelete: 'CASCADE'
    });
  }
};

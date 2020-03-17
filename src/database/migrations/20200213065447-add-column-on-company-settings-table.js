'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface
      .addColumn('company_settings', 'online_ceklok', {
        type: Sequelize.TINYINT,
        after: 'selfie_checklog',
        defaultValue: 0,
        allowNull: true
      })
      .then(() => {
        return queryInterface.addColumn('company_settings', 'ceklok_radius', {
          type: Sequelize.INTEGER,
          after: 'online_ceklok',
          defaultValue: 0,
          allowNull: true
        });
      })
      .then(() => {
        return queryInterface.addColumn('company_settings', 'manual_deduction', {
          type: Sequelize.TINYINT,
          after: 'ceklok_radius',
          defaultValue: 0,
          allowNull: true
        });
      });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface
      .removeColumn('company_settings', 'online_ceklok', Sequelize.TINYINT)
      .then(() => {
        return queryInterface.removeColumn('company_settings', 'ceklok_radius', Sequelize.INT);
      })
      .then(() => {
        return queryInterface.removeColumn(
          'company_settings',
          'manual_deduction',
          Sequelize.TINYINT
        );
      });
  }
};

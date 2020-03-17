'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize
      .query('ALTER TABLE schedule_swap_details DROP FOREIGN KEY schedule_swap_details_ibfk_2;')
      .then(() =>
        queryInterface.sequelize.query(
          'ALTER TABLE schedule_swap_details ADD CONSTRAINT schedule_swap_details_ibfk_2 FOREIGN KEY (schedule_id) REFERENCES defined_schedules (id) ON DELETE CASCADE;'
        )
      );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize
      .query('ALTER TABLE schedule_swap_details DROP FOREIGN KEY schedule_swap_details_ibfk_2;')
      .then(() =>
        queryInterface.sequelize.query(
          'ALTER TABLE schedule_swap_details ADD CONSTRAINT schedule_swap_details_ibfk_2 FOREIGN KEY (schedule_id) REFERENCES defined_schedules (id) ON DELETE RESTRICT;'
        )
      );
  }
};

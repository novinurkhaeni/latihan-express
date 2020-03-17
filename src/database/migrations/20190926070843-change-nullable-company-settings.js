'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(
      'ALTER TABLE company_settings MODIFY COLUMN notif_presence_overdue INT NULL, MODIFY COLUMN notif_overwork TINYINT NULL, MODIFY COLUMN notif_work_schedule INT NULL, MODIFY COLUMN payroll_date INT NULL;'
    );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(
      'ALTER TABLE company_settings MODIFY COLUMN notif_presence_overdue INT NOT NULL, MODIFY COLUMN notif_overwork TINYINT NOT NULL, MODIFY COLUMN notif_work_schedule INT NOT NULL, MODIFY COLUMN payroll_date INT NOT NULL;'
    );
  }
};

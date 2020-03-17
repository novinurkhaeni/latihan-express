'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize
      .query(
        'LOCK TABLES promo_privates WRITE, feedbacks WRITE, feedback_conversations WRITE, SequelizeMeta WRITE, users WRITE, abilities WRITE, abilities_categories WRITE, access_tokens WRITE, admin_access_tokens WRITE, admins WRITE, allowances WRITE, bank_data WRITE, bca_access_tokens WRITE, companies WRITE, company_settings WRITE, cron_employees WRITE, cron_members_salary_groups WRITE, cron_payroll_dates WRITE, cron_salary_groups WRITE, defined_schedules WRITE, deposit_histories WRITE, digital_assets WRITE, division_details WRITE, divisions WRITE, division_schedules WRITE, employee_notes WRITE, employee_pph21s WRITE, employees WRITE, employee_verifs WRITE, gajiandulu_data WRITE, home_dumps WRITE, journal_details WRITE, journals WRITE, logs WRITE, notifications WRITE, package_details WRITE, packages WRITE, parent_companies WRITE, periodic_pieces WRITE, pins WRITE, presences WRITE, promo_details WRITE, promos WRITE, ptkp WRITE, ptkp_details WRITE, salary_details WRITE, salary_groups WRITE, schedule_notes WRITE, schedule_shift_details WRITE, schedule_shifts WRITE, schedule_submissions WRITE, schedule_swap_details WRITE, schedule_swaps WRITE, schedule_templates WRITE, submissions WRITE, subscribements WRITE, subscription_details WRITE, subscriptions WRITE, transactions WRITE;'
      )
      .then(() => {
        return queryInterface.sequelize
          .query(
            'ALTER TABLE feedback_conversations DROP FOREIGN KEY feedback_conversations_ibfk_1, MODIFY feedback_id SMALLINT UNSIGNED;'
          )
          .then(() => {
            return queryInterface.sequelize
              .query('ALTER TABLE feedbacks MODIFY COLUMN id VARCHAR(13) NOT NULL;')
              .then(() => {
                return queryInterface.sequelize
                  .query(
                    'ALTER TABLE feedback_conversations MODIFY COLUMN feedback_id VARCHAR(13) NOT NULL;'
                  )
                  .then(() => {
                    return queryInterface.sequelize
                      .query(
                        'ALTER TABLE feedback_conversations ADD CONSTRAINT feedback_conversations_ibfk_1 FOREIGN KEY (feedback_id) REFERENCES feedbacks (id) ON DELETE CASCADE;'
                      )
                      .then(() => {
                        return queryInterface.sequelize
                          .query(
                            'ALTER TABLE feedback_conversations MODIFY COLUMN id INT(11) NOT NULL AUTO_INCREMENT;'
                          )
                          .then(() => {
                            return queryInterface.sequelize.query('UNLOCK TABLES;');
                          });
                      });
                  });
              });
          });
      });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize
      .query(
        'LOCK TABLES promo_privates WRITE, feedbacks WRITE, feedback_conversations WRITE, SequelizeMeta WRITE, users WRITE, abilities WRITE, abilities_categories WRITE, access_tokens WRITE, admin_access_tokens WRITE, admins WRITE, allowances WRITE, bank_data WRITE, bca_access_tokens WRITE, companies WRITE, company_settings WRITE, cron_employees WRITE, cron_members_salary_groups WRITE, cron_payroll_dates WRITE, cron_salary_groups WRITE, defined_schedules WRITE, deposit_histories WRITE, digital_assets WRITE, division_details WRITE, divisions WRITE, division_schedules WRITE, employee_notes WRITE, employee_pph21s WRITE, employees WRITE, employee_verifs WRITE, gajiandulu_data WRITE, home_dumps WRITE, journal_details WRITE, journals WRITE, logs WRITE, notifications WRITE, package_details WRITE, packages WRITE, parent_companies WRITE, periodic_pieces WRITE, pins WRITE, presences WRITE, promo_details WRITE, promos WRITE, ptkp WRITE, ptkp_details WRITE, salary_details WRITE, salary_groups WRITE, schedule_notes WRITE, schedule_shift_details WRITE, schedule_shifts WRITE, schedule_submissions WRITE, schedule_swap_details WRITE, schedule_swaps WRITE, schedule_templates WRITE, submissions WRITE, subscribements WRITE, subscription_details WRITE, subscriptions WRITE, transactions WRITE;'
      )
      .then(() => {
        return queryInterface.sequelize
          .query(
            'ALTER TABLE feedback_conversations DROP FOREIGN KEY feedback_conversations_ibfk_1, MODIFY feedback_id SMALLINT UNSIGNED;'
          )
          .then(() => {
            return queryInterface.sequelize
              .query('ALTER TABLE feedbacks MODIFY COLUMN id INT(11) NOT NULL AUTO_INCREMENT;')
              .then(() => {
                return queryInterface.sequelize
                  .query(
                    'ALTER TABLE feedback_conversations MODIFY COLUMN feedback_id INT(11) NOT NULL;'
                  )
                  .then(() => {
                    return queryInterface.sequelize
                      .query(
                        'ALTER TABLE feedback_conversations ADD CONSTRAINT feedback_conversations_ibfk_1 FOREIGN KEY (feedback_id) REFERENCES feedbacks (id) ON DELETE CASCADE;'
                      )
                      .then(() => {
                        return queryInterface.sequelize
                          .query(
                            'ALTER TABLE feedback_conversations MODIFY COLUMN id INT(11) NOT NULL;'
                          )
                          .then(() => {
                            return queryInterface.sequelize.query('UNLOCK TABLES;');
                          });
                      });
                  });
              });
          });
      });
  }
};

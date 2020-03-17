'use strict';
require('module-alias/register');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const payload = [
      // Owner
      {
        role: 1,
        ability:
          'PRESENCE_FULL_TIME_EDIT,SCHEDULE_EDIT,SCHEDULE_DELETE,SCHEDULE_ADD,MEMBER_RESPONSE,MEMBER_SALARY_SIGHT,MEMBER_DELETE,MEMBER_EDIT,MEMBER_ADD,PRESENCE_JOURNAL_EDIT,PRESENCE_NOTE_EDIT,PRESENCE_ADD_OWN_ID,PRESENCE_DELETE,PRESENCE_EDIT,PRESENCE_ADD,SALARY_GROUP_ADD_AND_EDIT,SUBMISSION_LEAVE,SUBMISSION_LEAVE_AMOUNT,SUBMISSION_CHECKLOG,BONUS_ADD,SUBMISSION_BONUS,PENALTY_ADD,SHIFT_ADD,SHIFT_EDIT,DELETE_SHIFT,SUBMISSION_SCHEDULE,DIVISION_ADD,DIVISION_EDIT,ACCESS_MULTIPLE_LOCATION',
        created_at: new Date(),
        updated_at: new Date()
      },
      // Manager
      {
        role: 3,
        ability:
          'MEMBER_SALARY_SIGHT,MEMBER_ADD,PRESENCE_ADD,PRESENCE_EDIT,SUBMISSION_LEAVE_AMOUNT,SUBMISSION_CHECKLOG,PENALTY_ADD,SHIFT_ADD,SHIFT_EDIT,DELETE_SHIFT,SCHEDULE_ADD,SCHEDULE_EDIT,SCHEDULE_DELETE,SUBMISSION_SCHEDULE,DIVISION_ADD,DIVISION_EDIT',
        created_at: new Date(),
        updated_at: new Date()
      },
      // Supervisor
      {
        role: 4,
        ability: 'PRESENCE_ADD,SUBMISSION_CHECKLOG,PENALTY_ADD,SHIFT_ADD,SCHEDULE_ADD',
        created_at: new Date(),
        updated_at: new Date()
      },
      // HRD
      {
        role: 5,
        ability:
          'MEMBER_SALARY_SIGHT,MEMBER_ADD,PRESENCE_ADD,PRESENCE_EDIT,SUBMISSION_LEAVE_AMOUNT,SUBMISSION_CHECKLOG,PENALTY_ADD,SHIFT_ADD,SHIFT_EDIT,DELETE_SHIFT,SCHEDULE_ADD,SCHEDULE_EDIT,SCHEDULE_DELETE,SUBMISSION_SCHEDULE,DIVISION_ADD,DIVISION_EDIT,ACCESS_MULTIPLE_LOCATION,SUBMISSION_LEAVE,SUBMISSION_LEAVE_AMOUNT,SUBMISSION_CHECKLOG,SUBMISSION_BONUS,SUBMISSION_SCHEDULE',
        created_at: new Date(),
        updated_at: new Date()
      },
      // LEADER DIVISION
      {
        role: 6,
        ability: 'PRESENCE_ADD,SUBMISSION_CHECKLOG,PENALTY_ADD,SHIFT_ADD,SCHEDULE_ADD',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
    return queryInterface.bulkInsert('abilities_categories', payload, {});
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('abilities_categories', null, {});
  }
};

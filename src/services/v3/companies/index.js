const scheduleSubmission = require('./scheduleSubmission');
const companyAbility = require('./companyAbility');
const memberSubmission = require('./memberSubmission');
const presenceSubmission = require('./presenceSubmission');
const member = require('./member');
const companySettingService = require('./company-settings.service');
const journal = require('./journal');
const salaryGroup = require('./salaryGroup');
const shift = require('./shift.service');
const periodicPieces = require('./periodic-pieces');
const branch = require('./branch');
const subscribement = require('./subscribement');
const company = require('./company');

module.exports = {
  scheduleSubmission,
  companyAbility,
  memberSubmission,
  presenceSubmission,
  member,
  companySettingService,
  journal,
  salaryGroup,
  shift,
  periodicPieces,
  branch,
  subscribement,
  company
};

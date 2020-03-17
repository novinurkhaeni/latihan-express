const profile = require('./profile.employees');
const member = require('./members');
const submission = require('./submission');
const verification = require('./verification');
const bankData = require('./bankData');
const salaryGroup = require('./salaryGroup');
const notification = require('./notification');
const withdraws = require('./withdraws');
const pdfReport = require('./pdfReport');

module.exports = {
  profile,
  member,
  submission,
  verification,
  bankData,
  salaryGroup,
  notification,
  withdraws,
  pdfReport
};

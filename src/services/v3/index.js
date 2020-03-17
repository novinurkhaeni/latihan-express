const membersService = require('./members');
const submissionsService = require('./submissions/submissions.service');
const presencesService = require('./presences/presences.service');
const schedulesService = require('./schedules');
const companiesService = require('./companies');
const register = require('./register');
const forgotPasswordService = require('./forgot-password/forgot.password.service');
const journalService = require('./journals');
const shiftService = require('./shift');
const checklogService = require('./checklog/checklog.service');
const transactionsService = require('./transactions');
const packageService = require('./packages/packages.service');
const subscribementService = require('./subscribements/subscribements.service');
const promosService = require('./promos/promos.service');
const periodicPieces = require('./periodic-pieces/periodic.pieces.services');
const demoService = require('./demo/demo.service');
const divisionService = require('./divisions/divisions.service');
const salaryGroupService = require('./salary-groups/salary.groups.service');
const otpService = require('./otp/otp.service');

module.exports = {
  membersService,
  submissionsService,
  presencesService,
  schedulesService,
  companiesService,
  register,
  forgotPasswordService,
  journalService,
  shiftService,
  checklogService,
  transactionsService,
  packageService,
  subscribementService,
  promosService,
  periodicPieces,
  demoService,
  divisionService,
  salaryGroupService,
  otpService
};

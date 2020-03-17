const registerService = require('./register/register.service');
const loginService = require('./login/login.service');
const companiesService = require('./companies');
const pinService = require('./pins/pins.service');
const dashboardService = require('./dashboard/dashboard.service');
const userService = require('./user/user.service');
const verifyService = require('./verify/verify.service');
const scheduleService = require('./schedule');
const submissionService = require('./submission');
const presencesService = require('./presences/presences.service');

module.exports = {
  registerService,
  loginService,
  companiesService,
  pinService,
  dashboardService,
  userService,
  verifyService,
  scheduleService,
  submissionService,
  presencesService
};

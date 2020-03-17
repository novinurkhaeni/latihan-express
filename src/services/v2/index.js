const dashboardService = require('./dashboard/dashboard.service');
const companySettingService = require('./company-settings/company-settings.service');
const scheduleService = require('./schedules/schedules.service');
const companiesService = require('./companies/companies.service');
const memberService = require('./members/members.service');
const divisionService = require('./divisions/divisions.service');
const checklog = require('./checklog/checklog.services');
const presenceService = require('./presences/presences.service');
const subscriptionService = require('./subscriptions/subscriptions.service');
const pinService = require('./pins/pin.service');
const payment = require('./payment/payment.service');

// eslint-disable-next-line no-unused-vars
module.exports = {
  dashboardService,
  companySettingService,
  scheduleService,
  companiesService,
  memberService,
  divisionService,
  checklog,
  presenceService,
  subscriptionService,
  pinService,
  payment
};

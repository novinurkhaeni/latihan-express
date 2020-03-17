const userService = require('./users/users.service.js');
const accessTokenService = require('./access-tokens/access.tokens.service.js');
const meService = require('./me/me.service.js');
const bankDataService = require('./bank-data/bank.data.service');
const digitalAssetService = require('./digital-assets/digital.assets.service');
const feedbackService = require('./feedbacks/feedbacks.service.js');
const feedbackConversationService = require('./feedback_conversations/feedback.conversation.service');
const forgotPasswordService = require('./forgot-password/forgot.password.service');
const promoService = require('./promos/promos.service');
const companyService = require('./companies/companies.service');
const companySettingService = require('./company-settings/company-settings.service');
const dashboardService = require('./dashboard/dashboard.service');
const memberService = require('./members/members.service');
const presenceService = require('./presences/presences.service');
const companyMemberService = require('./company-members/company.members.service');
const gajianduluDataService = require('./gajiandulu-data/gajiandulu-data.service');
const journalService = require('./journals/journals.service');
const scheduleService = require('./schedules/schedules.service');
const adminAccessTokenService = require('./admin-access-tokens/admin-access-tokens');
const abilityService = require('./ability/ability.service.js');
const vaService = require('./va/va.service');
const recapService = require('./recap/recap.service');
// eslint-disable-next-line no-unused-vars
module.exports = {
  userService,
  accessTokenService,
  meService,
  digitalAssetService,
  feedbackService,
  feedbackConversationService,
  forgotPasswordService,
  promoService,
  bankDataService,
  companyService,
  companySettingService,
  dashboardService,
  memberService,
  presenceService,
  companyMemberService,
  gajianduluDataService,
  journalService,
  scheduleService,
  adminAccessTokenService,
  abilityService,
  vaService,
  recapService
};

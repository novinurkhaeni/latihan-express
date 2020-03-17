const response = require('./response');
const jwtHelpers = require('./jwt');
const auth = require('./auth');
const authBca = require('./authBca');
const authMesinAbsensi = require('./authMesinAbsensi');
const notFound = require('./notFound');
const authAdmin = require('./authAdmin');
const compareCoordinates = require('./compareCoordinates');
const nodemailerMail = require('./mailer');
const oneSignalApi = require('./onesignal');
const presenceOverdueCheck = require('./presenceOverdueCheck');
const errorHandler = require('./errorHandler');
const dateHelper = require('./dateHelper');
const mailTemplates = require('./mail-templates');
const defaultAbility = require('./defaultAbility');
const abilityFinder = require('./abilityFinder');
const dateProcessor = require('./dateProcessor');
const scheduleTemplates = require('./scheduleTemplates');
const definedSchedules = require('./definedSchedules');
const timeConverter = require('./timeConverter');
const formatCurrency = require('./formatCurrency');
const countTotalSchedule = require('./countTotalSchedule');
const findRangedSchedules = require('./findRangedSchedules');
const findConflictedTemplateSchedule = require('./findConflictedTemplateSchedule');
const presences = require('./presences');
const countWorkdays = require('./countWorkdays');
const zeroWrapper = require('./zeroWrapper');
const letterGenerator = require('./letterGenerator');
const dateConverter = require('./dateConverter');
const timeShorten = require('./timeShorten');
const scheduleOrder = require('./scheduleOrder');
const scheduleCollector = require('./scheduleCollector');
const getAddress = require('./getAddress');
const generateNicepayMercToken = require('./nicepayMerchantToken');
const diffMonths = require('./diffMonths');
const dateGenerator = require('./dateGenerator');
const dayDiff = require('./dayDiff');
const dateTimeConverter = require('./dateTimeConverter');
const encrypt = require('./encrypt');
const decrypt = require('./decrypt');
const demoGenerator = require('./demoGenerator');

module.exports = {
  response,
  jwtHelpers,
  auth,
  authMesinAbsensi,
  notFound,
  authAdmin,
  compareCoordinates,
  nodemailerMail,
  oneSignalApi,
  presenceOverdueCheck,
  errorHandler,
  dateHelper,
  mailTemplates,
  defaultAbility,
  abilityFinder,
  dateProcessor,
  scheduleTemplates,
  definedSchedules,
  timeConverter,
  formatCurrency,
  countTotalSchedule,
  findRangedSchedules,
  findConflictedTemplateSchedule,
  presences,
  countWorkdays,
  zeroWrapper,
  letterGenerator,
  dateConverter,
  timeShorten,
  scheduleOrder,
  scheduleCollector,
  getAddress,
  authBca,
  generateNicepayMercToken,
  diffMonths,
  dateGenerator,
  dayDiff,
  dateTimeConverter,
  encrypt,
  decrypt,
  demoGenerator
};

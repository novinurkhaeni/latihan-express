const admin = require('./admin');
const user = require('./user');
const company = require('./company');
const employee = require('./employee');
const feedback = require('./feedback');
const promo = require('./promo');
const journal = require('./journal');
const journalDetail = require('./journalDetail');
const presence = require('./presence');
const gajianDuluData = require('./gajiandulu-data');
const upload = require('./upload');
const bankData = require('./bank-data');
const companySettings = require('./company-settings');
const feedbackConversations = require('./feedback-conversations');
const withdrawHistory = require('./withdraw-history');
const accessLevel = require('./accessLevel');
const categoryAccessLevel = require('./categoryAccessLevel');
const schedule = require('./schedule');
const subscription = require('./subscription');
const logs = require('./logs');
const ptkp = require('./ptkp');
const ptkpDetail = require('./ptkpDetail');
const userConfirmation = require('./userConfirmation');
const userMonitor = require('./userMonitor');
const exportExcel = require('./export-excel');

module.exports = {
  admin,
  user,
  company,
  employee,
  feedback,
  promo,
  journal,
  journalDetail,
  presence,
  gajianDuluData,
  upload,
  bankData,
  companySettings,
  feedbackConversations,
  withdrawHistory,
  accessLevel,
  categoryAccessLevel,
  schedule,
  subscription,
  logs,
  ptkp,
  ptkpDetail,
  userConfirmation,
  userMonitor,
  exportExcel
};

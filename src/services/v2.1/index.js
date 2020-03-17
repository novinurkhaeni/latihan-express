const checklog = require('./checklog/checklog.services');
const companiesService = require('./companies/companies.services');
const memberService = require('./members/members.service');
const companyBranchService = require('./company-branch/company.branch.service');
const ptkpService = require('./ptkp/ptkp.service');
const presenceService = require('./presences/presences.service');
const journalService = require('./journals/journals.service');
const noteService = require('./notes/notes.service');
const reportExcelService = require('./report-excel/report.excel.service');
const scheduleService = require('./schedules/schedules.service');

module.exports = {
  checklog,
  companiesService,
  memberService,
  companyBranchService,
  ptkpService,
  presenceService,
  journalService,
  noteService,
  reportExcelService,
  scheduleService
};

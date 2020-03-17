const EventEmitter = require('events').EventEmitter;
const UserRegistered = require('./UserRegistered');
const MemberLatePresence = require('./MemberLatePresence');
const MemberOverwork = require('./MemberOverwork');
const WithdrawChanged = require('./WithdrawChanged');
const UserActivityNotif = require('./UserActivityNotif');
const SubmissionApproval = require('./SubmissionApproval');
const SubmissionAbort = require('./SubmissionAbort');
const AskScheduleSwap = require('./askScheduleSwap');
const ScheduleSwapAgreement = require('./scheduleSwapAgreement');
const ScheduleSwapApproval = require('./scheduleSwapAprroval');
const GiveScheduleToTakeApproval = require('./giveScheduleToTakeApproval');
const TakeSchedule = require('./takeSchedule');
const Payment = require('./Payment');
const RejectMember = require('./RejectMember');
const Walktrough = require('./walktrough');
const SubmissionCreation = require('./submissionCreation');
const {
  PeriodicPieces,
  CronSalaryGroup,
  Subscribing,
  CronMembersSalaryGroup,
  CronPayrollDate,
  CronMonthlyAllowance,
  CronChangeEmployeeCompanyId,
  CronDeleteEmployee,
  CronPendingTransaction,
  CronGetBcaTransfer,
  CronPresence
} = require('./cron');

let observe = new EventEmitter();

const events = {
  UserRegistered: new UserRegistered(observe),
  MemberLatePresence: new MemberLatePresence(observe),
  MemberOverwork: new MemberOverwork(observe),
  WithdrawChanged: new WithdrawChanged(observe),
  PeriodicPieces: new PeriodicPieces(observe),
  CronSalaryGroup: new CronSalaryGroup(observe),
  Subscribing: new Subscribing(observe),
  CronMembersSalaryGroup: new CronMembersSalaryGroup(observe),
  CronPayrollDate: new CronPayrollDate(observe),
  UserActivityNotif: new UserActivityNotif(observe),
  CronMonthlyAllowance: new CronMonthlyAllowance(observe),
  CronChangeEmployeeCompanyId: new CronChangeEmployeeCompanyId(observe),
  SubmissionApproval: new SubmissionApproval(observe),
  SubmissionAbort: new SubmissionAbort(observe),
  AskScheduleSwap: new AskScheduleSwap(observe),
  ScheduleSwapAgreement: new ScheduleSwapAgreement(observe),
  ScheduleSwapApproval: new ScheduleSwapApproval(observe),
  GiveScheduleToTakeApproval: new GiveScheduleToTakeApproval(observe),
  TakeSchedule: new TakeSchedule(observe),
  CronDeleteEmployee: new CronDeleteEmployee(observe),
  Payment: new Payment(observe),
  CronPendingTransaction: new CronPendingTransaction(observe),
  CronGetBcaTransfer: new CronGetBcaTransfer(observe),
  RejectMember: new RejectMember(observe),
  Walktrough: new Walktrough(observe),
  SubmissionCreation: new SubmissionCreation(observe),
  CronPresence: new CronPresence(observe)
};

module.exports = { observe, events };

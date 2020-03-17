require('module-alias/register');
// const path = require('path');
const compress = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const express = require('express');
const config = require('config');
const { ApolloServer } = require('apollo-server-express');
const { apolloUploadExpress } = require('apollo-upload-server');
const cron = require('node-cron');
const fs = require('fs');

const { authAdmin, notFound } = require('@helpers');
const routes = require('./routes');
const { events, observe } = require('./eventemitter');
const schema = require('./schema');
const EVENT = require('./eventemitter/constants');

const graphqlPath = '/graphql';

const app = express();

//Global Variable
global.emailErrorLog = fs.createWriteStream(__dirname + '/../log/mailer.error.log', {
  flags: 'a'
});

// Global Variable for BCA Account Statement Logging
global.bcaAccountStatementLog = fs.createWriteStream(
  __dirname + '/../log/bca-account-statement.log',
  { flags: 'a' }
);

//Add Date Add Hours Method
Date.prototype.addHours = function(h) {
  this.setHours(this.getHours() + h);
  return this;
};

// Enable CORS, security, compression, favicon and body parsing
app.use(cors());
app.use(helmet());
app.use(compress());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(favicon(path.join(config.public), 'favicon.ico'));
// Host the public folder
// app.use('/', express.static(config.public));
app.use('/uploads', express.static(config.uploads));
app.use('/documents', express.static(config.documents));
// Event Listener
events.UserRegistered.listenUserRegistered();
events.UserRegistered.listenUserJoined();
events.UserRegistered.listenMemberAprroved();
events.MemberLatePresence.listenMemberLate();
events.MemberOverwork.listenMemberOverwork();
events.WithdrawChanged.listenWithdrawApproved();
events.WithdrawChanged.listenWithdrawRejected();
events.WithdrawChanged.listenWithdrawRequest();
events.PeriodicPieces.listenPeriodicPieces();
events.CronSalaryGroup.listenCronSalaryGroup();
events.Subscribing.listenSubscribing();
events.CronMembersSalaryGroup.listenCronMembersSalaryGroup();
events.CronPayrollDate.listenCronPayrollDate();
events.UserActivityNotif.listenUserActivityNotif();
events.CronMonthlyAllowance.listenCronMonthlyAllowance();
events.CronChangeEmployeeCompanyId.listenCronChangeEmployeeCompanyId();
events.SubmissionApproval.listenSubmissionApproval();
events.SubmissionAbort.listenSubmissionAbort();
events.AskScheduleSwap.listenAskScheduleSwap();
events.ScheduleSwapAgreement.listenScheduleSwapAgreement();
events.ScheduleSwapApproval.listenScheduleSwapApproval();
events.GiveScheduleToTakeApproval.listenGiveScheduleToTakeApproval();
events.TakeSchedule.listenTakeSchedule();
events.CronDeleteEmployee.listenCronDeleteEmployee();
events.Payment.listenPayment();
events.CronPendingTransaction.listenCronPendingTransaction();
events.CronGetBcaTransfer.listenCronGetBcaTransfer();
events.RejectMember.listenRejectMember();
events.Walktrough.listenCheckout();
events.SubmissionCreation.listenSubmissionCreation();
events.CronPresence.listenCronPresence();

// Cron - Set cron running on 01:00 WIB
cron.schedule('00 00 18 * * *', () => {
  observe.emit(EVENT.PERIODIC_PIECES);
  observe.emit(EVENT.CRON_MEMBERS_SALARY_GROUP);
  observe.emit(EVENT.SUBSCRIBING);
  observe.emit(EVENT.CRON_MONTHLY_ALLOWANCE);
  observe.emit(EVENT.CRON_CHANGE_EMPLOYEE_COMPANY_ID);
  // observe.emit(EVENT.CRON_DELETE_EMPLOYEE);
  //   observe.emit(EVENT.CRON_SALARY_GROUP);
});

// Cron - Precense
cron.schedule(
  '00 49 21 * * *',
  () => {
    observe.emit(EVENT.CRON_PRESENCE);
  },
  {
    scheduled: true,
    timezone: 'Asia/Jakarta'
  }
);

// Cron - Set cron for payroll date on 03:00 WIB
cron.schedule('00 00 20 * * *', () => {
  observe.emit(EVENT.CRON_PAYROLL_DATE);
});
// Cron - Set cron for check pending transaction every 30 minutes
cron.schedule('*/30 * * * *', () => {
  observe.emit(EVENT.CRON_PENDING_TRANSACTION);
});

// Cron - Set cron for get bca transfer every hour at 06:00 WIB - 07:00 WIB
cron.schedule(
  '00 00 6-7 * * *',
  () => {
    observe.emit(EVENT.CRON_GET_BCA_TRANSFER);
  },
  {
    scheduled: true,
    timezone: 'Asia/Jakarta'
  }
);
// Cron - Set cron for get bca transfer every 15 minutes at 08:00 WIB - 18:00 WIB
cron.schedule(
  '*/15 8-18 * * *',
  () => {
    observe.emit(EVENT.CRON_GET_BCA_TRANSFER);
  },
  {
    scheduled: true,
    timezone: 'Asia/Jakarta'
  }
);
// Cron - Set cron for get bca transfer every hour at 19:00 WIB - 22:00 WIB
cron.schedule(
  '00 00 19-22 * * *',
  () => {
    observe.emit(EVENT.CRON_GET_BCA_TRANSFER);
  },
  {
    scheduled: true,
    timezone: 'Asia/Jakarta'
  }
);

/**
 * API Version
 */
// Main App
app.use('/api/v1', routes.v1);
app.use('/api/v2', routes.v2);
app.use('/api/v2.1', routes.v21);
app.use('/api/v2.1.1', routes.v211);
app.use('/api/v3', routes.v3);
app.use('/api/v4', routes.v4);
// Mesin Absensi
app.use('/api/v1-mesin-absensi', routes.v1MesinAbsensi);
app.use('/api/v2-mesin-absensi', routes.v2MesinAbsensi);
app.use('/api/ma/v2', routes.v2Ma);

// Graphql End point
const server = new ApolloServer(schema);
app.use(graphqlPath, authAdmin, apolloUploadExpress({ maxFileSize: 6000000 }));
server.applyMiddleware({ app, graphqlPath });

app.use(notFound());

module.exports = app;

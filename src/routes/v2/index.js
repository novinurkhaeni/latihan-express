const { auth } = require('@helpers');
const express = require('express');

const companies = require('./companies');
const members = require('./members');
const divisions = require('./divisions');
const presences = require('./presences');
const schedules = require('./schedule');
const checklog = require('./checklog');
const salarySlip = require('./salary-slip');
const subscriptions = require('./subscriptions');
const pins = require('./pins');
const payment = require('./payment');

// Declare API Route and API Version
const v2 = express.Router();

v2.use('/companies', auth, companies);
v2.use('/members', auth, members);
v2.use('/divisions', auth, divisions);
v2.use('/presences', auth, presences);
v2.use('/schedules', auth, schedules);
v2.use('/checklog', auth, checklog);
v2.use('/salary', auth, salarySlip);
v2.use('/subscriptions', auth, subscriptions);
v2.use('/pin', auth, pins);
v2.use('/payment', auth, payment);

module.exports = v2;

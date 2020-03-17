const { auth } = require('@helpers');
const express = require('express');
const checklog = require('./checklog');
const companies = require('./companies');
const members = require('./members');
const companyBranch = require('./company-branch');
const ptkp = require('./ptkp');
const presences = require('./presences');
const schedules = require('./schedule');

// Declare API Route and API Version
const v21 = express.Router();
v21.use('/checklog', auth, checklog);
v21.use('/companies', auth, companies);
v21.use('/members', auth, members);
v21.use('/company-branch', auth, companyBranch);
v21.use('/ptkp', auth, ptkp);
v21.use('/presences', auth, presences);
v21.use('/schedules', auth, schedules);

module.exports = v21;

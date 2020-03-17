const { auth, authBca } = require('@helpers');
const express = require('express');

const register = require('./register');
const login = require('./login');
const users = require('./users');
const me = require('./me');
const digitalAsset = require('./digital-assets');
const feedback = require('./feedbacks');
const promo = require('./promos');
const forgotPassword = require('./forgot-password');
const bankData = require('./bank-data');
const companies = require('./companies');
const members = require('./members');
const refreshToken = require('./refresh-token');
const gdData = require('./gd-data');
const presences = require('./presences');
const schedules = require('./schedules');
const adminLogin = require('./admin');
const ability = require('./ability');
const oauth = require('./oauth');
const va = require('./va');
const recap = require('./recap');

// Declare API Route and API Version
const v1 = express.Router();

v1.use('/register', register);
v1.use('/login', login);
v1.use('/users', auth, users);
v1.use('/me', auth, me);
v1.use('/banks', auth, bankData);
v1.use('/digital-assets', auth, digitalAsset);
v1.use('/feedbacks', auth, feedback);
v1.use('/promos', promo);
v1.use('/forgot-password', forgotPassword);
v1.use('/companies', auth, companies);
v1.use('/members', auth, members);
v1.use('/refresh-token', refreshToken);
v1.use('/gd-data', auth, gdData);
v1.use('/presences', auth, presences);
v1.use('/schedules', auth, schedules);
v1.use('/admin', adminLogin);
v1.use('/ability', auth, ability);
v1.use('/oauth', oauth);
v1.use('/va', authBca, va);
v1.use('/recap', recap);

module.exports = v1;

const express = require('express');
const { auth } = require('@helpers');
const register = require('./register');
const login = require('./login');
const companies = require('./companies');
const pins = require('./pins');
const user = require('./user');
const verify = require('./verify');
const schedule = require('./schedule');
const submission = require('./submission');
const presences = require('./presences');

// Declare API Route and API Version
const v4 = express.Router();
v4.use('/register', register);
v4.use('/login', login);
v4.use('/companies', auth, companies);
v4.use('/forgot-pin', pins);
v4.use('/user', auth, user);
v4.use('/verify', verify);
v4.use('/submission', auth, submission);
v4.use('/schedule', auth, schedule);
v4.use('/presence', auth, presences);

module.exports = v4;

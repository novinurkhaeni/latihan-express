const { authMesinAbsensi } = require('@helpers');
const express = require('express');

const login = require('./login');
const checklog = require('./checklog');
const schedule = require('./schedule');

// Declare API Route and API Version
const v1MesinAbsensi = express.Router();

v1MesinAbsensi.use('/login', login);
v1MesinAbsensi.use('/checklog', authMesinAbsensi, checklog);
v1MesinAbsensi.use('/schedules', authMesinAbsensi, schedule);

module.exports = v1MesinAbsensi;

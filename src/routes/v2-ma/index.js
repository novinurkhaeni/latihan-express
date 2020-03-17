const { authMesinAbsensi } = require('@helpers');
const express = require('express');

const login = require('./login');
const parentCompany = require('./parent-company');
const members = require('./members');
const companies = require('./companies');
const pin = require('./pin');
const presences = require('./presences');
const digitalAsset = require('./digital-assets');

// Declare API Route and API Version
const v2Ma = express.Router();

v2Ma.use('/login', login);
v2Ma.use('/parent-company', authMesinAbsensi, parentCompany);
v2Ma.use('/members', authMesinAbsensi, members);
v2Ma.use('/companies', authMesinAbsensi, companies);
v2Ma.use('/pin', authMesinAbsensi, pin);
v2Ma.use('/presences', authMesinAbsensi, presences);
v2Ma.use('/digital-assets', authMesinAbsensi, digitalAsset);

module.exports = v2Ma;

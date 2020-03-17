const { authMesinAbsensi } = require('@helpers');
const express = require('express');

const me = require('./me');
const digitalAssets = require('./digital-assets');

// Declare API Route and API Version
const v2MesinAbsensi = express.Router();

v2MesinAbsensi.use('/me', authMesinAbsensi, me);
v2MesinAbsensi.use('/digital-assets', authMesinAbsensi, digitalAssets);

module.exports = v2MesinAbsensi;

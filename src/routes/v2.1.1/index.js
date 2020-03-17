const express = require('express');
const { auth } = require('@helpers');
const companies = require('./companies');
const checklog = require('./checklog');
const digitalAssets = require('./digital-assets');
const dump = require('./dump');

// Declare API Route and API Version
const v211 = express.Router();
v211.use('/companies', auth, companies);
v211.use('/checklog', auth, checklog);
v211.use('/digital-assets', auth, digitalAssets);
v211.use('/dump', auth, dump);

module.exports = v211;

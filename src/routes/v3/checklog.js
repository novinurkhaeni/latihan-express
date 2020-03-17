/* eslint-disable indent */
require('module-alias/register');
const { response } = require('@helpers');
const { checklogService: checklogServiceV211 } = require('@services/v2.1.1');
const { checklogService: checklogServiceV3 } = require('@services/v3');
const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  await checklogServiceV211.checklogValidation(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.message || error));
    }
    checklogServiceV3.checklog(req, res);
  });
});

module.exports = router;

/* eslint-disable indent */
require('module-alias/register');
const { response } = require('@helpers');
const { presenceService } = require('@services/v2-ma');
const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  await presenceService.checklogValidation(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.message || error));
    }
    presenceService.checklog(req, res);
  });
});

router.post('/rest', async (req, res) => {
  await presenceService.checklogValidation(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.message || error));
    }
    presenceService.rest(req, res);
  });
});

module.exports = router;

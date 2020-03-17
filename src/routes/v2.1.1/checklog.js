/* eslint-disable indent */
require('module-alias/register');
const { response } = require('@helpers');
const { checklogService } = require('@services/v2.1.1');
const express = require('express');
const router = express.Router();
// const { validationResult, query, param } = require('express-validator/check');

router.post('/', async (req, res) => {
  await checklogService.checklogValidation(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.message));
    }
    checklogService.checklog(req, res);
  });
});

router.post('/rest', async (req, res) => {
  // Before pass the request to service, we need to handle error
  await checklogService.checklogValidation(req, res, function(error) {
    if (error) return res.status(422).json(response(false, error.message));
    checklogService.rest(req, res);
  });
});

module.exports = router;

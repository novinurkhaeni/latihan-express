/* eslint-disable indent */
require('module-alias/register');
const { validationResult, param } = require('express-validator/check');
const { response } = require('@helpers');
const { checklogService } = require('@services/v2-mesin-absensi');
const express = require('express');
const router = express.Router();

router.get(
  '/:user_id/checklog/check',
  [
    param('user_id', 'user_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    checklogService.check(req, res);
  }
);

router.post('/:user_id/checklog', async (req, res) => {
  await checklogService.checklogValidation(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.message));
    }
    checklogService.checklog(req, res);
  });
});

router.post('/:user_id/rest', async (req, res) => {
  // Before pass the request to service, we need to handle error
  await checklogService.checklogValidation(req, res, function(error) {
    if (error) return res.status(422).json(response(false, error.message));
    checklogService.rest(req, res);
  });
});
module.exports = router;

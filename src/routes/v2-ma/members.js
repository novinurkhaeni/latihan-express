/* eslint-disable indent */
require('module-alias/register');
const { validationResult, param } = require('express-validator/check');
const { response } = require('@helpers');
const { presenceService } = require('@services/v2-ma');
const express = require('express');
const router = express.Router();

router.get(
  '/:employee_id/presence',
  [
    param('employee_id', 'employee_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    presenceService.check(req, res);
  }
);

module.exports = router;

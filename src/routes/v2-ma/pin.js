/* eslint-disable indent */
require('module-alias/register');
const { validationResult, body } = require('express-validator/check');
const { response } = require('@helpers');
const { pinService } = require('@services/v2-ma');
const express = require('express');
const router = express.Router();

router.post(
  '/verify',
  [
    body('*.employee_id', 'employee_id required')
      .exists()
      .not()
      .isEmpty(),
    body('*.pin', 'pin required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    pinService.verify(req, res);
  }
);

module.exports = router;

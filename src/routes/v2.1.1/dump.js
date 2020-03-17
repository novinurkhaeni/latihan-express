/* eslint-disable indent */
require('module-alias/register');
const { response } = require('@helpers');
const { dumpService } = require('@services/v2.1.1');
const express = require('express');
const router = express.Router();
const { validationResult, body } = require('express-validator/check');

router.post(
  '/',
  [
    body('*.employee_id', 'employee_id should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.type', 'type should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.identifier', 'identifier should not be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    dumpService.post(req, res);
  }
);

module.exports = router;

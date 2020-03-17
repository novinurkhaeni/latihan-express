require('module-alias/register');
const { response } = require('@helpers');
const { divisionService } = require('@services/v3');
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator/check');

router.post(
  '/',
  [
    body('*.name')
      .exists()
      .not()
      .isEmpty()
      .withMessage('Division name could not be empty'),
    body('*.member')
      .exists()
      .not()
      .isEmpty()
      .withMessage('Member could not be empty'),
    body('*.company_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('Member could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    divisionService.create(req, res);
  }
);

module.exports = router;

require('module-alias/register');
const { response } = require('@helpers');
const { payment } = require('@services/v2');
const express = require('express');
const router = express.Router();
const { validationResult, param } = require('express-validator/check');

router.get(
  '/:company_id',
  [
    param('company_id', 'company_id is required')
      .exists()
      .isNumeric()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    payment.getFee(req, res);
  }
);

module.exports = router;

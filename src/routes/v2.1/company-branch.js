require('module-alias/register');
const { response } = require('@helpers');
const { companyBranchService } = require('@services/v2.1');
const express = require('express');
const router = express.Router();
const { validationResult, body } = require('express-validator/check');

router.post(
  '/create',
  [
    body('*.company')
      .exists()
      .not()
      .isEmpty()
      .withMessage('company could not be empty'),
    body('*.company_settings')
      .exists()
      .not()
      .isEmpty()
      .withMessage('company settings could not be empty'),
    body('*.subscription')
      .exists()
      .not()
      .isEmpty()
      .withMessage('subscription could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    companyBranchService.create(req, res);
  }
);

module.exports = router;

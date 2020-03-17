require('module-alias/register');
const { response } = require('@helpers');
const { companyService } = require('@services/v2-ma');
const express = require('express');
const router = express.Router();
const { validationResult, param } = require('express-validator/check');

router.get(
  '/:parent_company_id',
  [
    param('parent_company_id', 'parent_company_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    companyService.get(req, res);
  }
);

module.exports = router;

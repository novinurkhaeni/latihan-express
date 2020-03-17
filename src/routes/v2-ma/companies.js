/* eslint-disable indent */
require('module-alias/register');
const { validationResult, param } = require('express-validator/check');
const { response } = require('@helpers');
const { companyService, membersService } = require('@services/v2-ma');
const express = require('express');
const router = express.Router();

router.get(
  '/:company_id',
  [
    param('company_id', 'company_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    companyService.getDetail(req, res);
  }
);

router.get(
  '/:company_id/members',
  [
    param('company_id', 'company_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    membersService.get(req, res);
  }
);

module.exports = router;

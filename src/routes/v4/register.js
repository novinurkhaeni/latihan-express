/* eslint-disable indent */
require('module-alias/register');
const { response } = require('@helpers');
const { registerService } = require('@services/v4');
const express = require('express');
const { body, validationResult } = require('express-validator/check');
const router = express.Router();

router.post(
  '/owner',
  [
    body('*.user')
      .exists()
      .not()
      .isEmpty()
      .withMessage('User could not be empty'),
    body('*.company')
      .exists()
      .not()
      .isEmpty()
      .withMessage('company could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    registerService.owner(req, res);
  }
);

router.post(
  '/employee',
  [
    body('*.user')
      .exists()
      .not()
      .isEmpty()
      .withMessage('user could not be empty'),
    body('*.pin')
      .exists()
      .not()
      .isEmpty()
      .withMessage('pin could not be empty'),
    body('*.company_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('company_id could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    registerService.employee(req, res);
  }
);

router.get('/check', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  registerService.checkCodename(req, res);
});
module.exports = router;

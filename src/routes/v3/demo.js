require('module-alias/register');
const { response } = require('@helpers');
const { demoService } = require('@services/v3');
const express = require('express');
const router = express.Router();
const { validationResult, query } = require('express-validator/check');

router.post(
  '/create',
  [
    query('user_id')
      .exists()
      .isNumeric()
      .not()
      .isEmpty(),
    query('company_id')
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
    demoService.create(req, res);
  }
);

router.get(
  '/done',
  [
    query('user_id')
      .exists()
      .isNumeric()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    // eslint-disable-next-line no-console
    console.log('it hit here');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    demoService.hasDone(req, res);
  }
);

module.exports = router;

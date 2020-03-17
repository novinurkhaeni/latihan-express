require('module-alias/register');
const { response } = require('@helpers');
const { promosService } = require('@services/v3');
const express = require('express');
const router = express.Router();
const { validationResult, query, body } = require('express-validator/check');

router.get(
  '/',
  [
    query('typeOfUse', 'typeOfUse required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    return promosService.get(req, res);
  }
);

router.get(
  '/check',
  query('code', 'code required')
    .exists()
    .not()
    .isEmpty(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    return promosService.check(req, res);
  }
);

router.post(
  '/private',
  [
    body('*.promo_code')
      .exists()
      .not()
      .isEmpty()
      .withMessage('promo_code could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    return promosService.createPrivate(req, res);
  }
);

module.exports = router;

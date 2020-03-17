require('module-alias/register');
const { response } = require('@helpers');
const { forgotPasswordService } = require('@services/v3');
const express = require('express');
const router = express.Router();
const { validationResult, body, query } = require('express-validator/check');

router.post(
  '/',
  [
    body('*.new_password', 'passwords must be at least 6 chars long')
      .exists()
      .isLength({
        min: 6
      }),
    body('*.phone', 'phone should be present').exists()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    forgotPasswordService.create(req, res);
  }
);

router.get(
  '/verify',
  [
    query('phone', 'phone required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    forgotPasswordService.verify(req, res);
  }
);

module.exports = router;

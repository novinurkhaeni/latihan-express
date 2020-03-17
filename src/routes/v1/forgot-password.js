require('module-alias/register');
const { response } = require('@helpers');
const { forgotPasswordService } = require('@services/v1');
const express = require('express');
const router = express.Router();
const { body, oneOf, validationResult } = require('express-validator/check');

router.post(
  '/',
  [
    body('*.emailphone')
      .exists()
      .not()
      .isEmpty()
      .withMessage('Tidak boleh kososng'),
    oneOf([
      body('*.emailphone')
        .isMobilePhone('id-ID')
        .withMessage('Must be phone number format'),
      body('*.emailphone')
        .isEmail()
        .withMessage('Must be valid email')
    ])
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    forgotPasswordService.create(req, res);
  }
);

module.exports = router;

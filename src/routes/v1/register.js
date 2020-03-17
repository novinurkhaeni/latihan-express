require('module-alias/register');
const { response } = require('@helpers');
const { userService, companyService } = require('@services/v1');
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator/check');

router.post(
  '/',
  [
    body('full_name', 'full name should be present')
      .matches(/^[A-Za-z\s]+$/i)
      .withMessage('full name can only contain char and space')
      .exists()
      .isLength({
        min: 4
      })
      .withMessage('full name must be at least 4 chars long'),
    body('email', 'email should be present')
      .exists()
      .isEmail()
      .withMessage('must be a valid email'),
    body('birthday')
      .exists()
      .isISO8601()
      .withMessage('birthday format should be YYYY-MM-DD'),
    body('password', 'passwords must be at least 6 chars long')
      .exists()
      .isLength({
        min: 6
      }),
    body('phone')
      .exists()
      .isMobilePhone('id-ID')
      .withMessage('phone must be phone number format')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    userService.create(req, res);
  }
);

router.put(
  '/otp',
  [
    // body('*.authorization_code', 'authorization_code should be present').exists(),
    body('*.hash', 'hash should be present').exists()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    userService.put(req, res);
  }
);

router.post(
  '/companies',
  [
    body('*.name')
      .exists()
      .withMessage('company name should exist')
      .isLength({
        min: 3
      })
      .withMessage('name must be at least 3 chars long'),
    body('*.unique_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('unique_id should exist'),
    body('*.address', 'address should be present').exists(),
    body('*.phone', 'must be phone number')
      .optional({
        nullable: true
      })
      .isNumeric()
      .optional({ no_symbols: true }),
    body('*.timezone', 'timezone should be present')
      .exists()
      .matches(/^(\w+[/]\w+)+$/)
      .withMessage('timezone format must be "continent/city"'),
    body('*.location')
      .exists()
      .withMessage('coordinate location needed')
      .not()
      .isEmpty()
      .withMessage('location cannot be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    companyService.create(req, res);
  }
);

module.exports = router;

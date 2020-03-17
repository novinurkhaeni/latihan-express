require('module-alias/register');
const { response } = require('@helpers');
const { register } = require('@services/v3');
const express = require('express');
const router = express.Router();
const { validationResult, body } = require('express-validator/check');

router.post(
  '/owner',
  [
    body('*.user.full_name', 'full name should be present')
      .exists()
      .not()
      .isEmpty()
      .withMessage('full_name should be exist'),
    body('*.user.birthday')
      .exists()
      .isISO8601()
      .withMessage('birthday format should be YYYY-MM-DD'),
    body('*.user.password', 'passwords must be at least 6 chars long')
      .exists()
      .isLength({
        min: 6
      }),
    body('*.user.phone')
      .exists()
      .not()
      .isEmpty()
      .withMessage('Phone number should be exist'),
    body('*.company.name')
      .exists()
      .withMessage('company name should exist')
      .isLength({
        min: 3
      })
      .withMessage('name must be at least 3 chars long'),
    body('*.company.unique_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('unique_id should exist'),
    body('*.company.address', 'address should be present').exists(),
    body('*.company.phone').optional({
      nullable: true
    }),
    body('*.company.timezone', 'timezone should be present')
      .exists()
      .matches(/^(\w+[/]\w+)+$/)
      .withMessage('timezone format must be "continent/city"'),
    body('*.company.location')
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
    register.user.createOwner(req, res);
  }
);

router.post(
  '/employee',
  [
    body('*.user.full_name', 'full name should be present')
      .exists()
      .not()
      .isEmpty()
      .withMessage('full_name should be exist'),
    body('*.user.birthday')
      .exists()
      .isISO8601()
      .withMessage('birthday format should be YYYY-MM-DD'),
    body('*.user.password', 'passwords must be at least 6 chars long')
      .exists()
      .isLength({
        min: 6
      }),
    body('*.user.phone')
      .exists()
      .withMessage('phone must be exist')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    register.user.createEmployee(req, res);
  }
);

module.exports = router;

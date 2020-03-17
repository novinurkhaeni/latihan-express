require('module-alias/register');
const { response } = require('@helpers');
const { subscribementService } = require('@services/v3');
const express = require('express');
const router = express.Router();
const { validationResult, body } = require('express-validator/check');

router.post(
  '/',
  [
    body('*.company_ids')
      .exists()
      .not()
      .isEmpty()
      .withMessage('company_ids could not be empty'),
    body('*.packages')
      .exists()
      .not()
      .isEmpty()
      .withMessage('packages could not be empty'),
    body('*.total_amount')
      .exists()
      .not()
      .isEmpty()
      .withMessage('total_amount could not be empty'),
    body('*.id_description')
      .exists()
      .not()
      .isEmpty()
      .withMessage('id_description could not be empty'),
    body('*.en_description')
      .exists()
      .not()
      .isEmpty()
      .withMessage('en_description could not be empty'),
    body('*.type')
      .exists()
      .not()
      .isEmpty()
      .withMessage('type could not be empty'),
    body('*.payment_method')
      .exists()
      .not()
      .isEmpty()
      .withMessage('payment_method could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    subscribementService.create(req, res);
  }
);

router.post(
  '/renew',
  [
    body('*.company_ids')
      .exists()
      .not()
      .isEmpty()
      .withMessage('company_ids could not be empty'),
    body('*.packages')
      .exists()
      .not()
      .isEmpty()
      .withMessage('packages could not be empty'),
    body('*.total_amount')
      .exists()
      .not()
      .isEmpty()
      .withMessage('total_amount could not be empty'),
    body('*.id_description')
      .exists()
      .not()
      .isEmpty()
      .withMessage('id_description could not be empty'),
    body('*.en_description')
      .exists()
      .not()
      .isEmpty()
      .withMessage('en_description could not be empty'),
    body('*.type')
      .exists()
      .not()
      .isEmpty()
      .withMessage('type could not be empty'),
    body('*.payment_method')
      .exists()
      .not()
      .isEmpty()
      .withMessage('payment_method could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    subscribementService.renew(req, res);
  }
);

router.post(
  '/new-location',
  [
    body('*.company_ids')
      .exists()
      .not()
      .isEmpty()
      .withMessage('company_ids could not be empty'),
    body('*.packages')
      .exists()
      .not()
      .isEmpty()
      .withMessage('packages could not be empty'),
    body('*.total_amount')
      .exists()
      .not()
      .isEmpty()
      .withMessage('total_amount could not be empty'),
    body('*.id_description')
      .exists()
      .not()
      .isEmpty()
      .withMessage('id_description could not be empty'),
    body('*.en_description')
      .exists()
      .not()
      .isEmpty()
      .withMessage('en_description could not be empty'),
    body('*.type')
      .exists()
      .not()
      .isEmpty()
      .withMessage('type could not be empty'),
    body('*.payment_method')
      .exists()
      .not()
      .isEmpty()
      .withMessage('payment_method could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    subscribementService.newLocation(req, res);
  }
);

router.get('/', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  subscribementService.get(req, res);
});

module.exports = router;

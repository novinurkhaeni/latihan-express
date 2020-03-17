require('module-alias/register');
const { response } = require('@helpers');
const { pinService } = require('@services/v2');
const express = require('express');
const router = express.Router();
const { body, validationResult, param } = require('express-validator/check');

router.post(
  '/',
  [
    body('*.employee_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('employee id could not be empty'),
    body('*.pin')
      .exists()
      .not()
      .isEmpty()
      .withMessage('pin could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    pinService.create(req, res);
  }
);

router.patch(
  '/:id',
  [
    body('*.pin')
      .exists()
      .not()
      .isEmpty()
      .withMessage('pin could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    pinService.edit(req, res);
  }
);

router.delete(
  '/:pin_id',
  [
    param('pin_id', 'pin id required')
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
    pinService.delete(req, res);
  }
);

module.exports = router;

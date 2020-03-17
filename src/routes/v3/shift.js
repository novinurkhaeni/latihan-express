require('module-alias/register');
const { response } = require('@helpers');
const { shiftService } = require('@services/v3');
const express = require('express');
const router = express.Router();
const { validationResult, param, body } = require('express-validator/check');

router.get(
  '/:shift_id',
  [
    param('shift_id', 'shift_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    return shiftService.shift.getDetail(req, res);
  }
);

router.patch(
  '/:shift_id',
  [
    param('shift_id', 'shift_id required')
      .exists()
      .not()
      .isEmpty(),
    body('*.shift_name')
      .exists()
      .not()
      .isEmpty()
      .withMessage('shift name could not be empty'),
    body('*.start_time')
      .exists()
      .not()
      .isEmpty()
      .withMessage('start time could not be empty'),
    body('*.end_time')
      .exists()
      .not()
      .isEmpty()
      .withMessage('end time could not be empty'),
    body('*.color')
      .exists()
      .not()
      .isEmpty()
      .withMessage('color could not be empty'),
    body('*.use_salary_per_shift')
      .exists()
      .not()
      .isEmpty()
      .withMessage('use_salary_per_shift could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    return shiftService.shift.editShift(req, res);
  }
);

router.delete(
  '/:shift_id',
  [
    param('shift_id', 'shift_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    return shiftService.shift.deleteShift(req, res);
  }
);

module.exports = router;

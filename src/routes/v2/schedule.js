require('module-alias/register');
const { response } = require('@helpers');
const { scheduleService } = require('@services/v2');
const express = require('express');
const router = express.Router();
const { query, body, validationResult } = require('express-validator/check');

router.post(
  '/create/once',
  [
    body('*.presence_date', 'presence_date cannot be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.member', 'member list is cannot be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.shift', 'shift is cannot be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    scheduleService.createScheduleOnce(req, res);
  }
);

router.post(
  '/create/continous',
  [
    body('*.start_date', 'start date cannot be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.end_date', 'end date cannot be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.member', 'member list is cannot be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.shift', 'shift is cannot be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    scheduleService.createScheduleContinous(req, res);
  }
);

router.get(
  '/:company_id/',
  [
    query('date', 'query date cannot be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    scheduleService.getSchedules(req, res);
  }
);

router.get(
  '/:schedule_id/detail',
  [
    query('type')
      .custom(value => {
        if (value.toString() !== 'once' && value.toString() !== 'continous') {
          return false;
        }
        return true;
      })
      .withMessage('query type must be once or continous')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    scheduleService.getScheduleDetail(req, res);
  }
);

router.patch(
  '/:schedule_id/',
  [
    body('*.employee_id', 'employee id cannot be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.date', 'date is cannot be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.shift', 'shift is cannot be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.type', 'type is cannot be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    scheduleService.editSchedule(req, res);
  }
);

router.delete(
  '/:schedule_id',
  [
    query('type')
      .custom(value => {
        if (value.toString() !== 'once' && value.toString() !== 'continous') {
          return false;
        }
        return true;
      })
      .withMessage('query type must be once or continous'),
    query('date', 'query date cannot be empty')
      .exists()
      .not()
      .isEmpty(),
    query('editType', 'query edit type cannot be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    scheduleService.deleteSchedule(req, res);
  }
);

module.exports = router;

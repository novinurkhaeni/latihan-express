require('module-alias/register');
const { response } = require('@helpers');
const { scheduleService } = require('@services/v1');
const express = require('express');
const router = express.Router();
const { query, body, validationResult } = require('express-validator/check');

/*
 * GET /schedules/{schedule_id}
 * Get schedule data by id
 */
router.get(
  '/:schedule_id',
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
    scheduleService.find(req, res);
  }
);

/*
 * PATCH /schedules/{schedule_id}/once
 * Edit schedule data type once
 */
router.patch('/:schedule_id/once', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  scheduleService.editOnce(req, res);
});

/*
 * DELETE /schedules
 * Delete schedule data
 */
router.delete(
  '',
  [
    body('*.employee_id')
      .exists()
      .withMessage('employee_id required'),
    body('*.schedule_id')
      .exists()
      .withMessage('schedule_id required'),
    body('*.defined_id')
      .exists()
      .withMessage('defined_id required'),
    body('*.delete_type')
      .custom(value => {
        if (value.toString() !== 'this' && value.toString() !== 'after') {
          return false;
        }
        return true;
      })
      .withMessage('delete_type must be this or after'),
    body('*.delete_date')
      .exists()
      .not()
      .isEmpty()
      .withMessage('delete_date cannot be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    scheduleService.delete(req, res);
  }
);

/*
 * PATCH /schedules/{schedule_id}/continous
 * Edit schedule data type continous
 */
router.patch('/:schedule_id/continous', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  scheduleService.editContinous(req, res);
});

module.exports = router;

require('module-alias/register');
const { response } = require('@helpers');
const { scheduleService } = require('@services/v4');
const express = require('express');
const { validationResult, query, param } = require('express-validator/check');
const router = express.Router();

/** Validation helper for schedule API v4 */
const isValidScheduleType = value => {
  switch (value) {
    case 'schedule_templates':
      return true;
    case 'defined_schedules':
      return true;
    default:
      throw new Error('Schedule type not supported!');
  }
};

router.get(
  '/:schedule_id/presence/:presence_id',
  [
    param('schedule_id', 'schedule ID is required!')
      .exists()
      .isNumeric()
      .not()
      .isEmpty(),
    // param('presence_id', 'presence ID is required!')
    //   .exists()
    //   .isNumeric()
    //   .not()
    //   .isEmpty(),
    query('schedule_type', 'schedule type is require')
      .exists()
      .not()
      .isEmpty()
      .custom(isValidScheduleType)
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    scheduleService.scheduleDetail.getScheduleDetail(req, res);
  }
);

router.patch(
  '/:schedule_id',
  [
    param('schedule_id', 'schedule_id required')
      .exists()
      .not()
      .isEmpty(),
    query('type', 'query type cannot be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    scheduleService.schedule.patchSchedule(req, res);
  }
);

router.delete('/presence', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  scheduleService.schedule.deleteSchedule(req, res);
});

module.exports = router;

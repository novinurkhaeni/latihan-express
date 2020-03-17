require('module-alias/register');
const { response } = require('@helpers');
const { schedulesService } = require('@services/v3');
const express = require('express');
const router = express.Router();
const { body, validationResult, param, query } = require('express-validator/check');

router.post(
  '/schedule-to-take',
  [
    body('*.date')
      .exists()
      .not()
      .isEmpty()
      .withMessage('date could not be empty'),
    body('*.shift_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('shift_id could not be empty'),
    body('*.note')
      .exists()
      .not()
      .isEmpty()
      .withMessage('note could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new schedulesService.scheduleToTake(req, res);
    service.postScheduleToTake();
  }
);

router.get(
  '/:schedule_id/schedule-to-take',
  [
    param('schedule_id', 'schedule_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new schedulesService.scheduleToTake(req, res);
    service.getScheduleToTakeDetail();
  }
);

router.patch(
  '/:schedule_id/schedule-to-take/take',
  [
    param('schedule_id', 'schedule_id required')
      .exists()
      .not()
      .isEmpty(),
    body('*.employee_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('employee_id could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new schedulesService.scheduleToTake(req, res);
    service.patchScheduleToTake();
  }
);

router.put(
  '/:schedule_id/schedule-to-take',
  [
    param('schedule_id', 'schedule_id required')
      .exists()
      .not()
      .isEmpty(),
    body('*.date')
      .exists()
      .not()
      .isEmpty()
      .withMessage('date could not be empty'),
    body('*.shift_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('shift_id could not be empty'),
    body('*.note')
      .exists()
      .not()
      .isEmpty()
      .withMessage('note could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new schedulesService.scheduleToTake(req, res);
    service.putScheduleToTake();
  }
);

router.get(
  '/:schedule_id/submission',
  [
    param('schedule_id', 'schedule_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new schedulesService.submission(req, res);
    service.getScheduleSubmissionDetail();
  }
);

router.get(
  '/:schedule_id/swap-schedule',
  [
    param('schedule_id', 'schedule_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new schedulesService.scheduleSwap(req, res);
    service.getScheduleSwapDetail();
  }
);

router.patch(
  '/:schedule_id/swap-schedule/abort',
  [
    param('schedule_id', 'schedule_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new schedulesService.scheduleSwap(req, res);
    service.abortScheduleSwap();
  }
);

router.patch(
  '/:schedule_id/swap-schedule/agreed',
  [
    param('schedule_id', 'schedule_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new schedulesService.scheduleSwap(req, res);
    service.agreedScheduleSwap();
  }
);

router.patch(
  '/submission/approval',
  [
    query('status', 'status required')
      .exists()
      .not()
      .isEmpty(),
    body('*.schedules')
      .exists()
      .not()
      .isEmpty()
      .withMessage('schedules could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new schedulesService.submission(req, res);
    service.patchSubmissionApproval();
  }
);

router.patch(
  '/:schedule_id/submission/abort',
  [
    param('schedule_id', 'schedule_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new schedulesService.submission(req, res);
    service.patchAbortSubmission();
  }
);

router.post('/continous', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  let service = new schedulesService.schedule(req, res);
  service.createScheduleContinous();
});

router.post('/once', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  let service = new schedulesService.schedule(req, res);
  service.createScheduleOnce();
});

router.get('/submission/history', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  let service = new schedulesService.submission(req, res);
  service.getHistory();
});

router.delete('/', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  let service = new schedulesService.schedule(req, res);
  service.deleteSchedule();
});

router.post(
  '/schedule-to-take/owner',
  [
    body('*.company_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('company_id could not be empty'),
    body('*.schedules')
      .exists()
      .not()
      .isEmpty()
      .withMessage('schedules could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new schedulesService.scheduleToTake(req, res);
    service.createScheduleToTake();
  }
);

module.exports = router;

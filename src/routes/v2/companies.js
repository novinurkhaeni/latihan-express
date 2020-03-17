require('module-alias/register');
const { response } = require('@helpers');
const {
  companySettingService,
  dashboardService,
  scheduleService,
  companiesService,
  subscriptionService
} = require('@services/v2');
const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator/check');

router.get(
  '/:company_id/summary',
  [
    query('start', 'failed need query start date').exists(),
    query('end', 'failed need query end date').exists(),
    query('dateInfo', 'failed need query info date').exists()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    dashboardService.get(req, res);
  }
);

router.post(
  '/:id/settings',
  [
    body('*.notif_presence_overdue', 'notif presence overdue should not be empty')
      .exists()
      .matches(/^[\d]+$/i)
      .withMessage('Only number that allowed'),
    body('*.presence_overdue_limit', 'presence overdue limit should not be empty')
      .exists()
      .matches(/^[\d]+$/i)
      .withMessage('Only number that allowed'),
    body('*.overwork_limit', 'overwork limit should not be empty')
      .exists()
      .matches(/^[\d]+$/i)
      .withMessage('Only number that allowed'),
    body('*.notif_overwork', 'notif overwork should not be empty').exists(),
    body('*.rest_limit', 'rest limit should not be empty')
      .exists()
      .matches(/^[\d]+$/i)
      .withMessage('Only number that allowed'),
    body('*.notif_work_schedule', 'notif work schedule should not be empty')
      .exists()
      .matches(/^[\d]+$/i)
      .withMessage('Only number that allowed'),
    body('*.payroll_date', 'payroll_date should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.salary_group', 'salary_group should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.salary_group.salary_name', 'salary_name should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.salary_group.salary_type', 'salary_type should not be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    companySettingService.create(req, res);
  }
);

router.post(
  '/:company_id/schedules/shift',
  [
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
      .withMessage('end time could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    scheduleService.create(req, res);
  }
);

router.get('/:company_id/schedules/shift', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  scheduleService.get(req, res);
});

router.get('/schedules/:shift_id/shift', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  scheduleService.detailShift(req, res);
});

router.delete('/schedules/:shift_id/shift', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  scheduleService.deleteShift(req, res);
});

router.patch('/schedules/:shift_id/shift', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  scheduleService.editShift(req, res);
});

router.post(
  '/:company_id/salary-group/',
  [
    body('*.salary_name')
      .exists()
      .not()
      .isEmpty()
      .withMessage('salary name could not be empty'),
    body('*.salary_type')
      .exists()
      .not()
      .isEmpty()
      .withMessage('salary type could not be empty'),
    body('*.salary')
      .exists()
      .not()
      .isEmpty()
      .withMessage('salary could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    companiesService.createSalaryGroup(req, res);
  }
);

router.get('/:company_id/salary-group/', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  companiesService.getSalaryGroup(req, res);
});

router.get('/:salary_group_id/salary-group/detail', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  companiesService.getSalaryGroupDetail(req, res);
});

router.get('/:salaryId/salary-group/check', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  companiesService.checkSalaryGroupUses(req, res);
});

router.get('/:salaryId/salary-group/check', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  companiesService.checkSalaryGroupUses(req, res);
});

router.patch(
  '/:salary_group_id/salary-group',
  [query('type', 'Query type is required').exists()],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    companiesService.editSalaryGroup(req, res);
  }
);

router.delete('/:salary_group_id/salary-group', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  companiesService.deleteSalaryGroup(req, res);
});

router.patch(
  '/:company_id/subscribe',
  [
    body('*.subscribe_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('subscribe id could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    subscriptionService.updateSubscription(req, res);
  }
);

router.get('/:company_id/subscriptions', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  subscriptionService.getCompanySubs(req, res);
});

module.exports = router;

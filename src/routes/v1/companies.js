require('module-alias/register');
const { response } = require('@helpers');
const {
  companyService,
  companySettingService,
  dashboardService,
  memberService,
  presenceService,
  companyMemberService,
  scheduleService
} = require('@services/v1');
const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator/check');

router.get(
  '/',
  [
    query('codename')
      .exists()
      .withMessage('need query codename included')
      .not()
      .isEmpty()
      .withMessage('codename cannot be empty data')
      .isLength({ min: 5 })
      .withMessage('wrong length of codename digit'),
    query('status')
      .exists()
      .withMessage('status required')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    companyService.get(req, res);
  }
);

router.get('/:company_id/presences/:presence_id', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  presenceService.get(req, res);
});

router.get(
  '/:company_id/presences',
  [
    query('date')
      .exists()
      .withMessage('query date required')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    presenceService.find(req, res);
  }
);

router.post(
  '/',
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

router.patch(
  '/:company_id',
  [
    body('*.name')
      .optional({ nullable: true })
      .isLength({ min: 3 })
      .withMessage('name must be at least 3 chars long'),
    body('*.unique_id').optional({ nullable: true }),
    body('*.address').optional({ nullable: true }),
    body('*.phone', 'must be phone number')
      .optional({ nullable: true })
      .isMobilePhone('id-ID'),
    body('*.timezone')
      .optional({ nullable: true })
      .matches(/^(\w+[/]\w+)+$/)
      .withMessage('timezone format must be "continent/city"'),
    body('*.location').optional({ nullable: true })
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    companyService.patch(req, res);
  }
);

router.get('/:company_id/settings', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  companySettingService.get(req, res);
});

router.patch(
  '/:id/settings',
  [
    body('*.notif_presence_overdue')
      .matches(/^[\d]+$/i)
      .withMessage('Only number that allowed')
      .optional({
        nullable: true
      }),
    body('*.presence_overdue_limit')
      .matches(/^[\d]+$/i)
      .withMessage('Only number that allowed')
      .optional({
        nullable: true
      }),
    body('*.overwork_limit')
      .matches(/^[\d]+$/i)
      .withMessage('Only number that allowed')
      .optional({
        nullable: true
      }),
    body('*.notif_overwork').optional({
      nullable: true
    }),
    body('*.rest_limit')
      .matches(/^[\d]+$/i)
      .withMessage('Only number that allowed')
      .optional({
        nullable: true
      }),
    body('*.notif_work_schedule')
      .matches(/^[\d]+$/i)
      .withMessage('Only number that allowed')
      .optional({
        nullable: true
      }),
    body('*.automated_payroll').optional({
      nullable: true
    })
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    companySettingService.patch(req, res);
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
    body('*.automated_payroll', 'automated payroll should not be empty').exists()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    companySettingService.create(req, res);
  }
);

router.get(
  '/:id/deposit-summary',
  [
    query('month', 'failed need query month and year').exists(),
    query('year', 'failed need query month and year').exists()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    dashboardService.get(req, res);
  }
);

router.get(
  '/:id/deposit-summary-an',
  [
    query('dateStart', 'failed need query date start').exists(),
    query('dateEnd', 'failed need query date end').exists()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    dashboardService.getAn(req, res);
  }
);

router.get(
  '/:company_id/members-an',
  [
    query('dateStart', 'query date start cannot be empty')
      .exists()
      .not()
      .isEmpty(),
    query('dateEnd', 'query date end cannot be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    companyMemberService.getAn(req, res);
  }
);

router.get('/:company_id/members', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  companyMemberService.get(req, res);
});

/*
 * GET /members/member_lists
 * Getting Member Lists
 */

router.get('/:company_id/member-lists', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  companyMemberService.lists(req, res);
});

router.post(
  '/:company_id/members',
  [
    body('*.name', 'name should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.email', 'email should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.phone', 'phone should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.salary', 'salary should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.workdays', 'workdays should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.daily_salary', 'daily_salary should not be empty')
      .exists()
      .not()
      .isEmpty(),
    // body('*.daily_salary_with_meal', 'daily_salary_with_meal should not be empty')
    //   .exists()
    //   .not()
    //   .isEmpty(),
    // body('*.meal_allowance', 'meal_allowance should not be empty')
    //   .exists()
    //   .not()
    //   .isEmpty(),
    body('*.role', 'role should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.flag', 'flag limit should not be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    memberService.create(req, res);
  }
);

/*
 * Export Presences
 */
router.get(
  '/:company_id/export/presences',
  [
    // Disabling this validation to accomodate difference version app
    // query('month', 'query month cannot be empty')
    //   .exists()
    //   .not()
    //   .isEmpty(),
    // query('year', 'query year cannot be empty')
    //   .exists()
    //   .not()
    //   .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    presenceService.export(req, res);
  }
);

/*
 * Get Schedule
 *
 */
router.get(
  '/:company_id/schedules',
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
    scheduleService.get(req, res);
  }
);

module.exports = router;

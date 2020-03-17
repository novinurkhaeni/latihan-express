require('module-alias/register');
const { response } = require('@helpers');
const { companySettingService } = require('@services/v2.1.1');
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator/check');

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

module.exports = router;

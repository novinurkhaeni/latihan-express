require('module-alias/register');
const { response } = require('@helpers');
const { companiesService } = require('@services/v3');
const express = require('express');
const router = express.Router();
const { validationResult, query, param, body } = require('express-validator/check');
const multer = require('multer');
const config = require('config');

// FOR UPLOADING IMAGE
const storage = multer.diskStorage({
  destination: config.uploads,
  filename: function(req, file, cb) {
    cb(null, Date.now() + '.' + file.mimetype.split('/')[1]);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 8000000, files: 3 },
  fileFilter: async function(req, file, cb) {
    // if (!req.body.type) {
    //   cb(new Error('Type need to be specified'));
    // }
    cb(null, true);
  }
}).single('file');

router.get('/:company_id/submission/presence', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  let service = new companiesService.presenceSubmission(req, res);
  service.getPresenceSubmission();
});

router.get('/:company_id/submission/members', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  let service = new companiesService.memberSubmission(req, res);
  service.getMembersSubmission();
});

router.get(
  '/:company_id/submission/schedule',
  [
    param('company_id', 'company_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.scheduleSubmission(req, res);
    service.getScheduleSubmission();
  }
);

router.get(
  '/:company_id/ability',
  [
    param('company_id', 'company_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.companyAbility(req, res);
    service.getCompaniesAbilities();
  }
);

router.patch(
  '/:company_ids/ability',
  [
    param('company_ids', 'company_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.companyAbility(req, res);
    service.editCompaniesAbilities();
  }
);

router.post(
  '/:company_id',
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
    body('*.salary_type', 'salary mode should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.role', 'role should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.date_start_work', 'date start work should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.date_end_work', 'date end work should not be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.member(req, res);
    service.createMember();
  }
);

router.post(
  '/:id/settings',
  [
    body('*.presence_overdue_limit', 'presence overdue limit should not be empty')
      .exists()
      .matches(/^[\d]+$/i)
      .withMessage('Only number that allowed'),
    body('*.rest_limit', 'rest limit should not be empty')
      .exists()
      .matches(/^[\d]+$/i)
      .withMessage('Only number that allowed')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }

    let service = new companiesService.companySettingService(req, res);
    service.create();
  }
);

router.get(
  '/:company_id/branch',
  [
    param('company_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('company_id is required')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }

    let service = new companiesService.branch(req, res);
    service.getBranch();
  }
);

router.patch(
  '/:company_id/branch',
  [
    param('company_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('company_id is required')
  ],
  (req, res) => {
    upload(req, res, function(error) {
      if (error) {
        return res.status(422).json(response(false, error.message));
      }
      let service = new companiesService.branch(req, res);
      service.editBranch();
    });
  }
);

router.post(
  '/:company_id/branch',
  [
    body('company_name')
      .exists()
      .not()
      .isEmpty()
      .withMessage('company_name could not be empty'),
    body('name')
      .exists()
      .not()
      .isEmpty()
      .withMessage('name could not be empty'),
    body('address')
      .exists()
      .not()
      .isEmpty()
      .withMessage('address could not be empty'),
    body('phone')
      .exists()
      .not()
      .isEmpty()
      .withMessage('phone could not be empty'),
    body('timezone')
      .exists()
      .not()
      .isEmpty()
      .withMessage('timezone could not be empty'),
    body('location')
      .exists()
      .not()
      .isEmpty()
      .withMessage('location could not be empty'),
    body('unique_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('unique_id could not be empty')
  ],
  (req, res) => {
    upload(req, res, function(error) {
      if (error) {
        return res.status(422).json(response(false, error.message));
      }
      let service = new companiesService.branch(req, res);
      service.createBranch();
    });
  }
);

router.get(
  '/:company_id/journal-other/history',
  [
    query('type', 'type required')
      .exists()
      .not()
      .isEmpty(),
    query('startDate', 'startDate required')
      .exists()
      .not()
      .isEmpty(),
    query('endDate', 'endDate required')
      .exists()
      .not()
      .isEmpty(),
    param('company_id', 'company_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.journal(req, res);
    service.getJournalHistory();
  }
);

router.get(
  '/:company_ids/salary-group',
  [
    // query('type', 'type required')
    //   .exists()
    //   .not()
    //   .isEmpty(),
    param('company_ids', 'company_ids required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.salaryGroup(req, res);
    service.getSalaryGroup();
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
      .withMessage('color could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.shift(req, res);
    service.createShift();
  }
);

router.get(
  '/:company_ids/periodic-pieces',
  [
    param('company_ids', 'company_ids required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.periodicPieces(req, res);
    service.getPeriodicPieces();
  }
);

router.get(
  '/:company_ids/payroll-list',
  [
    param('company_ids', 'company_ids required')
      .exists()
      .not()
      .isEmpty(),
    query('startDate', 'startDate required')
      .exists()
      .not()
      .isEmpty(),
    query('endDate', 'endDate required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.journal(req, res);
    service.getPayrollList();
  }
);

router.patch(
  '/:company_id/settings',
  [
    param('company_id', 'company_ids required')
      .exists()
      .not()
      .isEmpty(),
    body('*.payroll_date')
      .exists()
      .not()
      .isEmpty()
      .withMessage('payroll date could not be empty'),
    body('*.presence_overdue_limit')
      .exists()
      .not()
      .isEmpty()
      .withMessage('presence_overdue_limit could not be empty'),
    body('*.rest_limit')
      .exists()
      .not()
      .isEmpty()
      .withMessage('rest_limit could not be empty'),
    body('*.leave_quota')
      .exists()
      .not()
      .isEmpty()
      .withMessage('leave_quota could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.companySettingService(req, res);
    service.updateSettings();
  }
);

router.patch(
  '/:company_ids/settings/notification',
  [
    param('company_ids', 'company_ids required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.companySettingService(req, res);
    service.updateNotification();
  }
);

router.get(
  '/:company_id/settings/notification',
  [
    param('company_id', 'company_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.companySettingService(req, res);
    service.getNotificationSetting();
  }
);

router.get(
  '/:company_id/settings',
  [
    param('company_id', 'company_ids required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.companySettingService(req, res);
    service.getSettings();
  }
);

router.get(
  '/:company_id/subscribement',
  [
    param('company_id', 'company_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.subscribement(req, res);
    service.get();
  }
);

router.get('/:company_id/info', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  let service = new companiesService.companySettingService(req, res);
  service.getCompanyInfo();
});

router.patch(
  '/:company_ids/deactive',
  [
    param('company_ids', 'company_ids required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.company(req, res);
    service.deactive();
  }
);

router.get(
  '/:company_ids/hrd',
  [
    param('company_ids', 'company_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.member(req, res);
    service.getHrd();
  }
);

router.patch(
  '/:company_ids/ability',
  [
    param('company_ids', 'company_ids required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.companyAbility(req, res);
    service.editCompaniesAbilities();
  }
);

router.get(
  '/:company_ids/members',
  [
    param('company_ids', 'company_ids required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.member(req, res);
    service.getMembers();
  }
);

router.get(
  '/:company_ids/members/division',
  [
    param('company_ids', 'company_ids required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.member(req, res);
    service.getMembersForDivision();
  }
);

module.exports = router;

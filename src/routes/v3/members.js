require('module-alias/register');
const { response } = require('@helpers');
const { membersService } = require('@services/v3');
const express = require('express');
const router = express.Router();
const { body, validationResult, param, query } = require('express-validator/check');
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

const multipleUpload = multer({
  storage: storage,
  limits: { fileSize: 8000000, files: 3 },
  fileFilter: async function(req, file, cb) {
    // if (!req.body.type) {
    //   cb(new Error('Type need to be specified'));
    // }
    cb(null, true);
  }
}).array('files', 2);

router.post(
  '/:id/submission/leave-amount',
  [
    param('id', 'employeeId required')
      .exists()
      .not()
      .isEmpty(),
    body('*.amount')
      .exists()
      .not()
      .isEmpty()
      .withMessage('amount could not be empty'),
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
    membersService.member.createLeaveAmountSubmission(req, res);
  }
);

router.post('/:employee_id/submission/leave', (req, res) => {
  // Before pass the request to service, we need to handle error
  upload(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.message));
    }
    membersService.member.createLeaveSubmission(req, res);
  });
});

router.post(
  '/:employee_id/submission/bonus',
  [
    param('employee_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('employee_id could not be empty'),
    body('*.amount')
      .exists()
      .not()
      .isEmpty()
      .withMessage('amount could not be empty'),
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
    membersService.member.createBonusSubmission(req, res);
  }
);

router.patch(
  '/:employeeId/leave-amount',
  [
    param('employeeId', 'employeeId required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    membersService.member.patchLeaveAmount(req, res);
  }
);

router.get(
  '/:employeeId/schedules',
  [
    param('employeeId', 'employeeId required')
      .exists()
      .not()
      .isEmpty(),
    query('date')
      .isISO8601('yyyy-mm-dd')
      .withMessage('date must be valid with format yyyy-mm-dd')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    membersService.member.getBulkSchedule(req, res);
  }
);

router.patch(
  '/roles',
  [
    body('*.managers')
      .exists()
      .not()
      .isEmpty()
      .withMessage('managers could not be empty'),
    body('*.supervisors')
      .exists()
      .not()
      .isEmpty()
      .withMessage('supervisors could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    membersService.member.updateMembersRoles(req, res);
  }
);

router.patch(
  '/:employee_id/respond',
  [
    body('*.salary_type', 'salary_type should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.years_of_service', 'date_start_work should not be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    membersService.member.respondMember(req, res);
  }
);

router.patch(
  '/:employee_id',
  [
    param('employee_id', 'employee_id required')
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
    membersService.member.editMember(req, res);
  }
);

router.get(
  '/:employeeId/detail/profile',
  [
    param('employeeId', 'employeeId required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    membersService.profile.getEmployeeInfo(req, res);
  }
);

router.get(
  '/:employeeId/detail/salary',
  [
    param('employeeId', 'employeeId required')
      .exists()
      .not()
      .isEmpty(),
    query('startDate')
      .isISO8601('yyyy-mm-dd')
      .withMessage('start_date must be valid with format yyyy-mm-dd'),
    query('endDate')
      .isISO8601('yyyy-mm-dd')
      .withMessage('end_date must be valid with format yyyy-mm-dd')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    membersService.profile.getEmployeeSalary(req, res);
  }
);

router.get(
  '/:employeeId/journal',
  [
    param('employeeId', 'employeeId required')
      .exists()
      .not()
      .isEmpty(),
    query('presence_date')
      .isISO8601('yyyy-mm-dd')
      .withMessage('presence_date must be valid with format yyyy-mm-dd')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    membersService.profile.getEmployeeJournal(req, res);
  }
);

router.get(
  '/:employeeId/detail/presence',
  [
    param('employeeId', 'employeeId required')
      .exists()
      .not()
      .isEmpty(),
    query('startDate')
      .isISO8601('yyyy-mm-dd')
      .withMessage('start_date must be valid with format yyyy-mm-dd'),
    query('endDate')
      .isISO8601('yyyy-mm-dd')
      .withMessage('end_date must be valid with format yyyy-mm-dd')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    membersService.profile.getPresenceDetail(req, res);
  }
);

router.patch(
  '/:employeeId/profile/personal',
  [
    param('employeeId', 'employeeId required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    membersService.profile.updatePersonalInfo(req, res);
  }
);

router.patch(
  '/:employeeId/journal',
  [
    param('employeeId', 'employeeId required')
      .exists()
      .not()
      .isEmpty(),
    query('presence_date')
      .isISO8601('yyyy-mm-dd')
      .withMessage('presence_date must be valid with format yyyy-mm-dd')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    membersService.profile.updateEmployeeJournal(req, res);
  }
);

router.delete(
  '/:employeeId/delete',
  [
    param('employeeId', 'employeeId required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    membersService.profile.deleteEmployee(req, res);
  }
);

router.post('/:employeeId/submission/presence', (req, res) => {
  // Before pass the request to service, we need to handle error
  upload(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.message));
    }
    membersService.submission.createPresenceSubmission(req, res);
  });
});

router.get(
  '/:employee_id/submission/bonus/history',
  [
    param('employee_id')
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
    membersService.submission.getBonusSubmissionHistory(req, res);
  }
);

router.post(
  '/:employee_id/verif',
  [
    param('employee_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('employee_id could not be empty'),
    body('bank_name')
      .exists()
      .not()
      .isEmpty()
      .withMessage('bank_name could not be empty'),
    body('account_number')
      .exists()
      .not()
      .isEmpty()
      .withMessage('account_number could not be empty'),
    body('full_name')
      .exists()
      .not()
      .isEmpty()
      .withMessage('full_name could not be empty')
  ],
  (req, res) => {
    multipleUpload(req, res, function(error) {
      if (error) {
        return res.status(422).json(response(false, error));
      }
      membersService.verification.upload(req, res);
    });
  }
);

router.get(
  '/:employee_id/verif',
  [
    param('employee_id')
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
    membersService.verification.getVerification(req, res);
  }
);

router.patch(
  '/:employee_id/verif',
  [
    param('employee_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('employee_id could not be empty'),
    body('bank_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('bank_id could not be empty'),
    body('ktp_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('ktp_id could not be empty'),
    body('selfie_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('selfie_id could not be empty')
  ],
  (req, res) => {
    multipleUpload(req, res, function(error) {
      if (error) {
        return res.status(422).json(response(false, error));
      }
      membersService.verification.editVerification(req, res);
    });
  }
);

router.delete(
  '/:employee_id/bank-data',
  [
    param('employee_id')
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
    membersService.bankData.delete(req, res);
  }
);

router.patch('/:employee_id/phone', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  membersService.member.editPhone(req, res);
});

router.patch(
  '/:employee_id/salary-group',
  [
    param('employee_id')
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
    membersService.salaryGroup.update(req, res);
  }
);

router.patch(
  '/:employee_id/demo',
  [
    param('employee_id')
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
    membersService.member.updateDemo(req, res);
  }
);

router.patch(
  '/:employee_id/notification',
  [
    param('employee_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('employee_id could not be empty'),
    body('*.is_read')
      .exists()
      .not()
      .isEmpty()
      .withMessage('is_read could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    membersService.notification.patch(req, res);
  }
);

router.patch(
  '/:employee_id/reject',
  [
    param('employee_id')
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
    membersService.member.reject(req, res);
  }
);

router.post(
  '/:employee_id/withdraws',
  [
    body('*.total_amount', 'total_amount must be an integer and cannot be empty')
      .isInt()
      .not()
      .isEmpty()
      .trim(),
    body('*.total_nett', 'total_nett must be an integer and cannot be empty')
      .isInt()
      .not()
      .isEmpty()
      .trim(),
    body('*.fee', 'fee must be an integer and cannot be empty')
      .isInt()
      .not()
      .isEmpty()
      .trim(),
    body('*.tax', 'tax must be an integer and cannot be empty')
      .isInt()
      .not()
      .isEmpty()
      .trim()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    membersService.withdraws.create(req, res);
  }
);

router.get(
  '/:employee_id/pdf-report',
  [
    param('employee_id', 'employee_id required')
      .exists()
      .isNumeric()
      .not()
      .isEmpty(),
    query('start', 'start date required')
      .exists()
      .not()
      .isEmpty(),
    query('end', 'end date required')
      .exists()
      .not()
      .isEmpty(),
    query('category', 'category required')
      .exists()
      .not()
      .isEmpty()
  ],

  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    switch (req.query.category) {
      case 'salary-slip':
        membersService.pdfReport.salarySlip(req, res);
        break;
      case 'progressive-salary':
        membersService.pdfReport.progressiveSalary(req, res);
        break;
      default:
        break;
    }
  }
);

router.patch(
  '/:employee_ids/hrd',
  [
    param('employee_ids')
      .exists()
      .not()
      .isEmpty()
      .withMessage('employee_ids could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    membersService.member.setToHrd(req, res);
  }
);

router.delete(
  '/:employee_id/abort-salary',
  [
    param('employee_id')
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
    membersService.salaryGroup.abortSalaryChange(req, res);
  }
);

module.exports = router;

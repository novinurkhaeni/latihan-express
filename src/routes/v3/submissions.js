require('module-alias/register');
const { response } = require('@helpers');
const { submissionsService } = require('@services/v3');
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
    if (!req.body.type) {
      cb(new Error('Type need to be specified'));
    }
    cb(null, true);
  }
}).single('file');

router.get('/:submissionId/leave', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  submissionsService.getLeaveSubmissionDetail(req, res);
});

router.get('/:submissionId/bonus', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  submissionsService.getBonusSubmissionDetail(req, res);
});

router.patch(
  '/:submissionIds/approval',
  [
    query('status', 'status required')
      .exists()
      .not()
      .isEmpty(),
    param('submissionIds', 'submissionIds required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    submissionsService.patchApprovalSubmission(req, res);
  }
);

router.delete('/:submissionId/bonus/abort', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  submissionsService.abortBonusSubmission(req, res);
});

router.patch('/:submissionId/bonus/edit', (req, res) => {
  upload(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.array()));
    }
    submissionsService.editBonusSubmission(req, res);
  });
});

router.get(
  '/:submissionId/leave-amount',
  [
    param('submissionId', 'submissionId required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    submissionsService.getLeaveAmountSubmissionDetail(req, res);
  }
);

router.patch(
  '/:submissionId/leave-amount/edit',
  [
    body('*.amount')
      .exists()
      .not()
      .isEmpty()
      .withMessage('amount could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    submissionsService.editLeaveAmountSubmission(req, res);
  }
);

router.delete(
  '/:submissionId/leave-amount/abort',
  [
    param('submissionId', 'submissionId required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    submissionsService.abortLeaveAmountSubmission(req, res);
  }
);

router.patch('/:submissionId/leave/edit', (req, res) => {
  upload(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.array()));
    }
    submissionsService.editLeaveSubmission(req, res);
  });
});

router.delete(
  '/:submissionId/leave/abort',
  [
    param('submissionId', 'submissionId required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    submissionsService.abortLeaveSubmission(req, res);
  }
);

router.patch(
  '/throw-schedule',
  [
    body('*.schedules')
      .exists()
      .not()
      .isEmpty()
      .withMessage('data could not be empty'),
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
    submissionsService.createThrowSchedule(req, res);
  }
);

router.post(
  '/schedule-swap',
  [
    body('*.company_id')
      .exists()
      .not()
      .isEmpty()
      .withMessage('company_id could not be empty'),
    body('*.self_data')
      .exists()
      .not()
      .isEmpty()
      .withMessage('self_data could not be empty'),
    body('*.away_data')
      .exists()
      .not()
      .isEmpty()
      .withMessage('away_data could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    submissionsService.createScheduleSwap(req, res);
  }
);

router.get('/history', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  submissionsService.getHistory(req, res);
});

module.exports = router;

require('module-alias/register');
const { response } = require('@helpers');
const { meService, feedbackService, feedbackConversationService } = require('@services/v1');
const express = require('express');
const multer = require('multer');
const config = require('config');
const router = express.Router();
const { body, query, validationResult, param } = require('express-validator/check');

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
      cb(
        new Error(
          'Please specify the type first, type can be checkin, checkout or rest_start, rest_end'
        )
      );
    }

    if (!req.body.location) {
      cb(new Error('Please specify the location first, in lat and long coordinates'));
    }

    const valid = await meService.checklogValidation(req, req.res);

    if (valid !== true) {
      cb(new Error(valid));
    } else {
      cb(null, true);
    }
  }
}).single('file');

/*
 * GET /me/feedbacks
 * Get all feedbacks data
 */
router.get('/feedbacks', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  feedbackService.get(req, res);
});

/*
 * POST /me/feedbacks
 * Create new feedbacks
 */
router.post(
  '/feedbacks',
  [
    body('*.summary', 'feedback summary required')
      .exists()
      .trim(),
    body('*.message', 'feedback message required')
      .exists()
      .trim()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    feedbackService.create(req, res);
  }
);

/*
 * POST /me/conversation
 * Send Feedback Conversation
 */
router.post(
  '/conversation',
  [
    body('*.feedback_id', 'feedback_id should be string').exists(),
    body('*.message', 'your message can not be empty').exists()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    feedbackConversationService.create(req, res);
  }
);

/*
 * PATCH /me
 * Edit personal information
 */
router.patch(
  '/',
  [
    body('*.full_name')
      .optional({ nullable: true })
      .matches(/^[A-Za-z\s]+$/i)
      .withMessage('name should only has chars and space')
      .isLength({
        min: 4
      })
      .withMessage('name minimum 4 characters'),
    body('*.email')
      .optional({ nullable: true })
      .isEmail()
      .withMessage('must be a valid email'),

    body('*.phone')
      .optional({ nullable: true })
      .matches(/^[\d]+$/i)
      .withMessage('Only number that allowed'),

    body('*.timezone')
      .optional({ nullable: true })
      .matches(/^(\w+[/]\w+)+$/)
      .withMessage('timezone format must be "continent/city"'),

    body('*.birthday')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('birthday format should be YYYY-MM-DD'),

    body('*.old_password', 'old password required to change new password').custom(
      (value, { req }) => {
        if (req.body.data.new_password) {
          return value ? true : false;
        }
        return true;
      }
    ),
    body('*.new_password', 'new password required').custom((value, { req }) => {
      if (req.body.data.old_password) {
        return value ? true : false;
      }
      return true;
    })
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    meService.patch(req, res);
  }
);

/*
 * GET /me/notifications
 * Get all notification data
 */
router.get('/notifications', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  meService.get(req, res);
});

/*
 * GET /me/deposit-summary
 * Get salary information of user role member
 */
router.get(
  '/deposit-summary/member',
  [
    query('dateStart', 'failed need query start date')
      .exists()
      .not()
      .isEmpty(),
    query('dateEnd', 'failed need query end date')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    meService.getDeposit(req, res);
  }
);

router.get(
  '/deposit-summary',
  [
    query('month', 'failed need query month and year')
      .exists()
      .isNumeric()
      .not()
      .isEmpty(),
    query('year', 'failed need query month and year')
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
    meService.deposit(req, res);
  }
);

/*
 * POST /me/checklog/rest
 * Sending rest request
 */
router.post('/checklog/rest', (req, res) => {
  // Before pass the request to service, we need to handle error
  upload(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.message));
    }

    meService.rest(req, res);
  });
});

/*
 * POST /me/checklog
 * Sending checklog request
 */
router.post('/checklog', (req, res) => {
  // Before pass the request to service, we need to handle error
  upload(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.message));
    }

    meService.checklog(req, res);
  });
});

/*
 * GET /me/withdraws
 * Get all withdraws that have been created
 */
router.get(
  '/:employeeId/withdraws',
  [
    param('employeeId', 'employee id required')
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
    meService.getWithdraws(req, res);
  }
);

/*
 * POST /me/withdraws
 * Post a withdraw request
 */
router.post(
  '/withdraws',
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
    meService.withdraws(req, res);
  }
);

module.exports = router;

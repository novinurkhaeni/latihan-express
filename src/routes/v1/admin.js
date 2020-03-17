require('module-alias/register');
const { response } = require('@helpers');
const {
  adminAccessTokenService,
  digitalAssetService,
  companyService,
  journalService,
  forgotPasswordService
} = require('@services/v1');
const { authAdmin } = require('@helpers');
const express = require('express');
const multer = require('multer');
const config = require('config');
const router = express.Router();
const { param, body, validationResult } = require('express-validator/check');

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
      cb(new Error('Please specify the type first, type must be withdraw'));
    }

    if (!req.body.uploadable_type) {
      cb(
        new Error(
          'Please specify the uploadable_type first, type can be employees or companies or users, following the table name referenced'
        )
      );
    }

    if (!req.body.uploadable_id) {
      cb(
        new Error(
          'Please specify the uploadable_id first, the id number based on id number in the table name you set for uploadable_type'
        )
      );
    }

    cb(null, true);
  }
}).single('file');

router.post(
  '/login',
  [
    body('*.email')
      .exists()
      .withMessage('Email or Phone cannot be empty'),
    body('*.password', 'passwords must be at least 5 chars long').isLength({
      min: 5
    })
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    adminAccessTokenService.create(req, res);
  }
);

router.post('/assets', authAdmin, (req, res) => {
  upload(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.message));
    }

    digitalAssetService.admin(req, res);
  });
});

router.post(
  '/company-reminder/:company_id',
  authAdmin,
  [
    param('company_id')
      .exists()
      .withMessage('Company id cannot be empty'),
    body('*.name')
      .exists()
      .withMessage('Company name cannot be empty'),
    body('*.codename')
      .exists()
      .withMessage('Company codename cannot be empty'),
    body('*.address')
      .exists()
      .withMessage('Company address cannot be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    companyService.emailReminder(req, res);
  }
);

router.patch(
  '/reject-withdraw/:withdraw_id',
  authAdmin,
  [
    param('withdraw_id')
      .exists()
      .withMessage('Withdraw id cannot be empty'),
    body('*.status')
      .exists()
      .withMessage('Withdraw status cannot be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    journalService.rejectWithdraw(req, res);
  }
);

router.post(
  '/reset-password',
  authAdmin,
  [
    body('*.emailphone')
      .exists()
      .withMessage('emailphone cannot be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    forgotPasswordService.create(req, res);
  }
);

module.exports = router;

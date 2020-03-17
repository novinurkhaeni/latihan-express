/* eslint-disable indent */
require('module-alias/register');
const { response } = require('@helpers');
const path = require('path');
const { memberService, journalService, noteService } = require('@services/v2.1');
const express = require('express');
const router = express.Router();
const { body, validationResult, query, param } = require('express-validator/check');
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
    if (!req.body.uploadable_type) {
      cb(new Error('Uploadable type need to be spefified'));
    }

    if (!req.body.type) {
      cb(new Error('Type need to be specified'));
    }
    cb(null, true);
  }
}).single('file');

// FOR UPLOADING EXCEL
const storageExcel = multer.diskStorage({
  destination: config.uploads,
  filename: function(req, file, cb) {
    cb(null, Date.now() + '-' + req.params.company_id + '-' + file.originalname);
  }
});

const uploadExcel = multer({
  storage: storageExcel,
  limits: { fileSize: 8000000, files: 1 },
  fileFilter: async function(req, file, cb) {
    const fileType = /xlsx/;
    const extName = fileType.test(path.extname(file.originalname).toLowerCase());
    if (extName) {
      return cb(null, true);
    }
    cb(new Error('File yang diupload salah'));
  }
}).single('file');

router.post('/:employee_id/confirmation-info', (req, res) => {
  // Before pass the request to service, we need to handle error
  upload(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.message));
    }
    memberService.createConfirmationInfo(req, res);
  });
});

router.get(
  '/:employee_id/detail',
  [
    query('dateStart', 'start date required')
      .exists()
      .not()
      .isEmpty(),
    query('dateEnd', 'end date required')
      .exists()
      .not()
      .isEmpty(),
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
    memberService.getDetail(req, res);
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
    body('*.salaryType', 'salary mode should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.role', 'role should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.dateStartWork', 'role should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.pph21', 'pph21 should not be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    memberService.createMember(req, res);
  }
);

router.get(
  '/:employee_id/detail',
  [
    query('dateStart', 'start date required')
      .exists()
      .not()
      .isEmpty(),
    query('dateEnd', 'end date required')
      .exists()
      .not()
      .isEmpty(),
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
    memberService.getDetail(req, res);
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
        memberService.salarySlip(req, res);
        break;
      case 'progressive-salary':
        memberService.progressiveSalary(req, res);
        break;
      default:
        break;
    }
  }
);

router.patch(
  '/:employee_id',
  [
    body('*.full_name', 'name should not be empty')
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
    body('*.salaryGroupId', 'salary id should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.salaryType', 'salary mode should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.role', 'role should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.dateStartWork', 'role should not be empty')
      .exists()
      .not()
      .isEmpty(),
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
    memberService.editMember(req, res);
  }
);

router.post(
  '/:employee_id/journals',
  [
    param('employee_id', 'employee id required')
      .exists()
      .isNumeric()
      .not()
      .isEmpty(),
    body('*.type', 'type cannot be empty')
      .exists()
      .not()
      .isEmpty()
      .isString(),
    body('*.debet', 'debet atleast value of zero')
      .exists()
      .isNumeric()
      .not()
      .isEmpty(),
    body('*.kredit', 'kredit atleast value of zero')
      .exists()
      .isNumeric()
      .not()
      .isEmpty(),
    body('*.description', 'description cannot be empty')
      .exists()
      .not()
      .isEmpty()
      .isString()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    journalService.post(req, res);
  }
);

router.post(
  '/:employee_id/notes',
  [
    param('employee_id', 'employee id required')
      .exists()
      .isNumeric()
      .not()
      .isEmpty(),
    body('*.date', 'date cannot be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.notes', 'notes cannot be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    noteService.create(req, res);
  }
);

router.get(
  '/:employee_id/confirmation-info',
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
    memberService.confirmationInfo(req, res);
  }
);

router.get(
  '/:company_id/template',

  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    memberService.requestTemplate(req, res);
  }
);

router.post('/:company_id/import', (req, res) => {
  uploadExcel(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.message));
    }
    memberService.importMember(req, res);
  });
});
module.exports = router;

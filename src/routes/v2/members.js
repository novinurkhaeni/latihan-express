require('module-alias/register');
const { response } = require('@helpers');
const { memberService } = require('@services/v2');
const express = require('express');
const multer = require('multer');
const config = require('config');
const path = require('path');
const router = express.Router();
const { body, validationResult, query, param } = require('express-validator/check');

const storage = multer.diskStorage({
  destination: config.uploads,
  filename: function(req, file, cb) {
    cb(null, Date.now() + '-' + req.params.company_id + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
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
    body('*.salaryId', 'salary id should not be empty')
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

router.post('/:company_id/import', (req, res) => {
  upload(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.message));
    }
    memberService.importMember(req, res);
  });
});

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

router.get(
  '/:employee_id/salary-slip',
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
      .isEmpty()
  ],

  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    memberService.salarySlip(req, res);
  }
);

router.post(
  '/periodic-pieces/create',
  [
    body('*.employee_id', 'employee id should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.amount', 'amount should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.type', 'type should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.repeat_type', 'repeat type id should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.start', 'date start should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.end', 'date end should not be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    memberService.createPeriodic(req, res);
  }
);

router.get(
  '/:employee_id/periodic-pieces',
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
    memberService.getPeriodic(req, res);
  }
);

router.get(
  '/:periodic_id/periodic-pieces/detail',
  [
    param('periodic_id', 'periodic_id required')
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
    memberService.getPeriodicDetail(req, res);
  }
);

router.patch(
  '/:periodic_id/periodic-pieces',
  [
    body('*.employee_id', 'employee id should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.amount', 'amount should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.type', 'type should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.repeat_type', 'repeat type id should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.start', 'date start should not be empty')
      .exists()
      .not()
      .isEmpty(),
    body('*.end', 'date end should not be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    memberService.editPeriodic(req, res);
  }
);

router.delete(
  '/:periodic_id/periodic-pieces',
  [
    param('periodic_id', 'periodic_id required')
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
    memberService.deletePeriodic(req, res);
  }
);

router.patch(
  '/:employee_id/respond',
  [
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
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    memberService.respondMember(req, res);
  }
);

module.exports = router;

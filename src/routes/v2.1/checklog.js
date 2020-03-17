/* eslint-disable indent */
require('module-alias/register');
const { response } = require('@helpers');
const { checklog, reportExcelService } = require('@services/v2.1');
const express = require('express');
const router = express.Router();
const { validationResult, query, param } = require('express-validator/check');
const multer = require('multer');
const config = require('config');

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

    const valid = await checklog.checklogValidation(req, req.res);

    if (valid !== true) {
      cb(new Error(valid));
    } else {
      cb(null, true);
    }
  }
}).single('file');

router.post('/', (req, res) => {
  // Before pass the request to service, we need to handle error
  upload(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.message));
    }

    checklog.checklog(req, res);
  });
});

router.post('/rest', (req, res) => {
  // Before pass the request to service, we need to handle error
  upload(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.message));
    }

    checklog.rest(req, res);
  });
});

router.get(
  '/:company_id/export/presences',
  [
    query('category', 'category required')
      .exists()
      .not()
      .isEmpty(),
    param('company_id', 'company id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    if (res.local.users.employeeRole === 2) {
      return res
        .status(403)
        .json(response(false, 'Hanya manajer yang dapat meminta data presensi'));
    }
    switch (req.query.category) {
      case '1':
        reportExcelService.all(req, res);
        break;
      case '2':
        reportExcelService.attendanceReport(req, res);
        break;
      case '3':
        reportExcelService.attendanceStatisticReport(req, res);
        break;
      case '4':
        reportExcelService.presenceReport(req, res);
        break;
      case '5':
        reportExcelService.salaryReport(req, res);
        break;
      case '6':
        reportExcelService.pph21(req, res);
        break;
      default:
    }
  }
);

module.exports = router;

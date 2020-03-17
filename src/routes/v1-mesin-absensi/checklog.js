require('module-alias/register');
const { response } = require('@helpers');
const { checklog } = require('@services/v2');
const { meService } = require('@services/v1');
const express = require('express');
const multer = require('multer');
const config = require('config');
const router = express.Router();
const { validationResult, param } = require('express-validator/check');

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

    const valid = await meService.checklogValidation(req, req.res, false);

    if (valid !== true) {
      cb(new Error(valid));
    } else {
      cb(null, true);
    }
  }
}).single('file');

router.post('/:id', (req, res) => {
  // Before pass the request to service, we need to handle error
  upload(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.message));
    }

    checklog.checklog(req, res, false);
  });
});

router.post('/rest/:id', (req, res) => {
  // Before pass the request to service, we need to handle error
  upload(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.message));
    }

    meService.rest(req, res, false);
  });
});

router.get(
  '/:id/check',
  [
    param('id', 'employee_id required')
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
    checklog.check(req, res);
  }
);

module.exports = router;

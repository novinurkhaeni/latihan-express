require('module-alias/register');
const { response } = require('@helpers');
const { presencesService } = require('@services/v4');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const config = require('config');
const { validationResult } = require('express-validator/check');

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
    if (!req.query.type) cb(new Error('Type of param can not be empty'));

    if (req.query.type) {
      let types = ['attend', 'absence', 'leave', 'permit', 'holiday'];
      const isEmpty = types.find(type => type === req.query.type.toString());

      if (!isEmpty) cb(new Error('Type of param not found'));
    }

    if (!req.body.employee_id) {
      cb(new Error('Employee_id can not be empty'));
    }

    if (!req.body.presence_start) {
      cb(new Error('Presence_start can not be empty'));
    }

    if (!req.body.presence_end) {
      cb(new Error('Presence_end can not be empty'));
    }

    if (req.body.is_back_date === '') {
      cb(new Error('Is_back_date can not be empty'));
    }

    cb(null, true);
  }
}).single('file');

router.post('/', (req, res) => {
  upload(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.message));
    }
    presencesService.createPresenceManual(req, res);
  });
});

router.post('/manual_now', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  presencesService.createPresenceManualNow(req, res);
});

module.exports = router;

require('module-alias/register');
const { response } = require('@helpers');
const { digitalAssetService } = require('@services/v2-ma');
const express = require('express');
const router = express.Router();
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
      cb(new Error('Please specify the type'));
      return true;
    }
    if (!req.body.uploadable_type) {
      cb(new Error('Please specify uploadable_type'));
      return true;
    }
    if (!req.body.uploadable_id) {
      cb(new Error('Please provide uploadable_id property'));
      return true;
    }
    cb(null, true);
  }
}).single('file');

router.post('/', (req, res) => {
  // Before pass the request to service, we need to handle error
  upload(req, res, function(error) {
    if (error) {
      return res.status(422).json(response(false, error.message));
    }
    digitalAssetService.post(req, res);
  });
});

module.exports = router;

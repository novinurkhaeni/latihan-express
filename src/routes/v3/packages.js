require('module-alias/register');
const { response } = require('@helpers');
const { packageService } = require('@services/v3');
const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator/check');

router.get('/', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  packageService.get(req, res);
});

module.exports = router;

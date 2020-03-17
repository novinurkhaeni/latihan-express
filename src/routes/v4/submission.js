require('module-alias/register');
const { response } = require('@helpers');
const { submissionService } = require('@services/v4');
const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator/check');

router.get('/availability', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  submissionService.availability.get(req, res);
});

module.exports = router;

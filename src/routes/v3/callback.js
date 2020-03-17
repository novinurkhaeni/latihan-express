require('module-alias/register');
const { response } = require('@helpers');
const { transactionsService } = require('@services/v3');
const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator/check');

router.get('/nicepay/cc/non-reccuring', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  transactionsService.nicepay.ccNonReccuringCallback(req, res);
});

router.post('/nicepay/cc/non-reccuring/notif', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  transactionsService.nicepay.ccNonReccuringDbProcess(req, res);
});

module.exports = router;

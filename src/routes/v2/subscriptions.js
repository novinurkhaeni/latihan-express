require('module-alias/register');
const { response } = require('@helpers');
const { subscriptionService } = require('@services/v2');
const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator/check');

router.get('/', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  subscriptionService.getSubscription(req, res);
});

module.exports = router;

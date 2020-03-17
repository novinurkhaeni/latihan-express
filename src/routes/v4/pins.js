require('module-alias/register');
const { response } = require('@helpers');
const { pinService } = require('@services/v4');
const express = require('express');
const router = express.Router();
const { validationResult, query } = require('express-validator/check');

router.post(
  '/',
  [
    query('phone', 'phone required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    pinService.forgot(req, res);
  }
);

module.exports = router;

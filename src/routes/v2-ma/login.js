require('module-alias/register');
const { response } = require('@helpers');
const { accessTokenService } = require('@services/v2-ma');
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator/check');

router.post(
  '/',
  [
    body('*.password', 'passwords must be at least 5 chars long').isLength({
      min: 5
    })
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    accessTokenService.create(req, res);
  }
);

module.exports = router;

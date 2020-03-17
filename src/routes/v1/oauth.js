require('module-alias/register');
const { response } = require('@helpers');
const { accessTokenService } = require('@services/v1');
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator/check');

// Route for BCA Login
router.post(
  '/token',
  [
    body('grant_type')
      .exists()
      .not()
      .isEmpty()
      .withMessage('grant_type must be included')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    accessTokenService.createBca(req, res);
  }
);

module.exports = router;

/* eslint-disable indent */
require('module-alias/register');
const { response } = require('@helpers');
const { userService } = require('@services/v4');
const express = require('express');
const { validationResult, param } = require('express-validator/check');
const router = express.Router();

router.get(
  '/:user_id/status',
  [
    param('user_id', 'user_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    userService.checkUserStatus(req, res);
  }
);

module.exports = router;

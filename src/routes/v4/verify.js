/* eslint-disable indent */
require('module-alias/register');
const { verifyService } = require('@services/v4');
const express = require('express');
const { validationResult, query } = require('express-validator/check');
const router = express.Router();

router.get(
  '/',
  [
    query('code', 'code required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.end('URL tidak valid');
    }
    verifyService.verify(req, res);
  }
);

module.exports = router;

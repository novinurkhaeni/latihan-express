require('module-alias/register');
const { response } = require('@helpers');
const { recapService } = require('@services/v1');
const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator/check');

router.get(
  '/',
  [
    query('year', 'year required')
      .exists()
      .not()
      .isEmpty(),
    query('totalPresence', 'totalPresence required')
      .exists()
      .not()
      .isEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    recapService.get(req, res);
  }
);

module.exports = router;

require('module-alias/register');
const { response } = require('@helpers');
const { scheduleService } = require('@services/v1-mesin-absensi');
const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator/check');

router.get(
  '/:company_id/',
  [
    query('date', 'query date cannot be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    scheduleService.getSchedules(req, res);
  }
);
module.exports = router;

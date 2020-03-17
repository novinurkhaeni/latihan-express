require('module-alias/register');
const { response } = require('@helpers');
const { otpService } = require('@services/v3');
const express = require('express');
const router = express.Router();
const { validationResult, query } = require('express-validator/check');

router.post('/', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  otpService.create(req, res);
});

router.get(
  '/verify',
  [
    query('phone', 'phone required')
      .exists()
      .not()
      .isEmpty(),
    query('code', 'code required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    otpService.verify(req, res);
  }
);

module.exports = router;

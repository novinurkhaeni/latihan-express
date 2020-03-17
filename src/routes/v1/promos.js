require('module-alias/register');
const { response } = require('@helpers');
const { promoService } = require('@services/v1');
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator/check');

router.post(
  '',
  [
    body('*.code', 'code should be present in request body')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    promoService.apply(req, res);
  }
);

module.exports = router;

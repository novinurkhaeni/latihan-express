require('module-alias/register');
const { response } = require('@helpers');
const { ptkpService } = require('@services/v2.1');
const express = require('express');
const router = express.Router();
const { validationResult, param } = require('express-validator/check');

router.get('/', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  ptkpService.get(req, res);
});

router.get(
  '/:ptkpId/details',
  [
    param('ptkpId', 'PTKP Id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    ptkpService.getDetail(req, res);
  }
);

module.exports = router;

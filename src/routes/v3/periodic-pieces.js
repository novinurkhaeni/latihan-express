require('module-alias/register');
const { response } = require('@helpers');
const { periodicPieces } = require('@services/v3');
const express = require('express');
const router = express.Router();
const { validationResult, param } = require('express-validator/check');

router.delete(
  '/:id',
  [
    param('id', 'id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    periodicPieces.delete(req, res);
  }
);

module.exports = router;

require('module-alias/register');
const { response } = require('@helpers');
const { gajianduluDataService } = require('@services/v1');
const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator/check');
/*
 * Feedback
 */
router.get('/', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  gajianduluDataService.get(req, res);
});

module.exports = router;

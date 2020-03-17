require('module-alias/register');
const { response } = require('@helpers');
const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator/check');
const { loginService } = require('@services/v4');

router.post('/', (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }

  loginService.check(req, res);
});

module.exports = router;

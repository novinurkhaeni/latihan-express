require('module-alias/register');
const { response } = require('@helpers');
const { userService } = require('@services/v1');
const express = require('express');
const router = express.Router();
const { validationResult, body } = require('express-validator/check');

router.get('/', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  userService.find(req, res);
});

router.get('/:id', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  userService.get(req, res);
});

router.patch(
  '/demo',
  [
    body('*.demo_mode')
      .exists()
      .not()
      .isEmpty()
      .withMessage('demo mode could not be empty'),
    body('*.demo_step')
      .exists()
      .not()
      .isEmpty()
      .withMessage('demo step could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    userService.patchDemo(req, res);
  }
);

router.get('/demo/get', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  userService.getDemo(req, res);
});

module.exports = router;

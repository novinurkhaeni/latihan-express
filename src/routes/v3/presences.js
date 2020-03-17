require('module-alias/register');
const { response } = require('@helpers');
const { presencesService } = require('@services/v3');
const express = require('express');
const router = express.Router();
const { param, validationResult, query, body } = require('express-validator/check');

router.get(
  '/:presenceId/custom-presence',
  [
    param('presenceId', 'presenceId required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    presencesService.getCustomPresenceDetail(req, res);
  }
);

router.get(
  '/:presenceId/detail',
  [
    param('presenceId', 'presenceId required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    presencesService.getPresenceDetail(req, res);
  }
);

router.post(
  '/create',
  [
    query('type', 'query type should be present')
      .exists()
      .custom((value, { req }) => {
        if (
          value.toString() === 'absence' ||
          value.toString() === 'leave' ||
          value.toString() === 'holiday' ||
          value.toString() === 'permit' ||
          value.toString() === 'attend'
        ) {
          return true;
        }
        throw new Error('query type must be absence, leave, permit, holiday or attend');
      }),
    body('*.presence_start', 'presence_start should be present').exists(),
    body('*.presence_end', 'presence_end should be present').exists(),
    body('*.member', 'member should be present with type array and contain list of id member')
      .exists()
      .isArray(),
    body('*.member.*', 'member should be present with type array and contain list of id member')
      .exists()
      .isNumeric()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    presencesService.createPresenceManual(req, res);
  }
);

module.exports = router;

require('module-alias/register');
const { response } = require('@helpers');
const { presenceService } = require('@services/v2');
const express = require('express');
const router = express.Router();
const { query, body, validationResult } = require('express-validator/check');

/*
 * POST /presences/create
 * Create manual presence data by manager
 */
router.post(
  '/:company_id/create',
  [
    query('type')
      .optional({ nullable: true })
      .custom((value, { req }) => {
        if (
          value.toString() === 'absence' ||
          value.toString() === 'leave' ||
          value.toString() === 'holiday'
        ) {
          return true;
        }

        throw new Error('query type optional and must be absence, leave or holiday');
      }),
    body('data').custom((value, { req }) => {
      if (!req.query.type) {
        if (!value.presence_start) {
          throw new Error('presence_start cannot be empty');
        }
        if (!value.presence_end) {
          throw new Error('presence_end cannot be empty');
        }
      }
      return true;
    }),
    body('*.bonus')
      .optional({ nullable: true })
      .isNumeric()
      .withMessage('bonus must be numeric character'),
    body('*.penalty')
      .optional({ nullable: true })
      .isNumeric()
      .withMessage('penalty must be numeric character')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    presenceService.create(req, res);
  }
);

/*
 * DELETE /presences/{presence_id}
 * Delete presence data
 */
router.delete('/:presence_id', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  presenceService.delete(req, res);
});

router.patch('/:presence_id/edit', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  presenceService.patch(req, res);
});

module.exports = router;

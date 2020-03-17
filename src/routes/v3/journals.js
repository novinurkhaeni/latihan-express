require('module-alias/register');
const { response } = require('@helpers');
const { journalService } = require('@services/v3');
const express = require('express');
const router = express.Router();
const { body, validationResult, param, query } = require('express-validator/check');

router.post(
  '/other',
  [
    query('type', 'param type required')
      .exists()
      .not()
      .isEmpty(),
    body('*.note')
      .exists()
      .not()
      .isEmpty()
      .withMessage('note could not be empty'),
    body('*.amount')
      .exists()
      .not()
      .isEmpty()
      .withMessage('type could not be empty'),
    body('*.employee_ids')
      .exists()
      .not()
      .isEmpty()
      .withMessage('type could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    journalService.adjustment.addAdjustment(req, res);
  }
);

router.post(
  '/periodic-pieces',
  [
    body('*.note')
      .exists()
      .not()
      .isEmpty()
      .withMessage('note could not be empty'),
    body('*.amount')
      .exists()
      .not()
      .isEmpty()
      .withMessage('amount, could not be empty'),
    body('*.employee_ids')
      .exists()
      .not()
      .isEmpty()
      .withMessage('employee_ids could not be empty'),
    body('*.date')
      .exists()
      .not()
      .isEmpty()
      .withMessage('frequent could not be empty'),
    body('*.duration')
      .exists()
      .not()
      .isEmpty()
      .withMessage('duration could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    journalService.periodicPieces.addPeriodicPieces(req, res);
  }
);

router.patch(
  '/:journal_id/edit',
  [
    query('type', 'query type required')
      .exists()
      .not()
      .isEmpty(),
    body('*.note')
      .exists()
      .not()
      .isEmpty()
      .withMessage('note could not be empty'),
    body('*.amount')
      .exists()
      .not()
      .isEmpty()
      .withMessage('amount could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    journalService.adjustment.editJournalBonusOrPenalty(req, res);
  }
);

router.delete(
  '/:journal_id/delete',
  [
    param('journal_id', 'journal_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    journalService.adjustment.deleteJournalBonusOrPenalty(req, res);
  }
);

router.get('/withdraw/data', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  journalService.withdraw.companiesWithdraw(req, res);
});

module.exports = router;

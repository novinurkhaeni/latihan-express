require('module-alias/register');
const { response } = require('@helpers');
const { divisionService } = require('@services/v2');
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator/check');

router.get('/:company_id', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  divisionService.getDivision(req, res);
});

router.post(
  '/:company_id',
  [
    body('*.name')
      .exists()
      .not()
      .isEmpty()
      .withMessage('Division name could not be empty'),
    body('*.member')
      .exists()
      .not()
      .isEmpty()
      .withMessage('Member could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    divisionService.createDivision(req, res);
  }
);

router.get('/:division_id/detail', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  divisionService.getDivisionDetail(req, res);
});

router.delete('/:division_id', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  divisionService.deleteDivision(req, res);
});

router.patch('/:division_id', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  divisionService.editDivision(req, res);
});

module.exports = router;

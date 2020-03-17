require('module-alias/register');
const { response } = require('@helpers');
const { companiesService, presenceService } = require('@services/v2.1');
const express = require('express');
const router = express.Router();
const { validationResult, body } = require('express-validator/check');

router.get('/:company_id/salary-group/', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  companiesService.getSalaryGroup(req, res);
});

router.get('/:salary_group_id/salary-group/detail', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  companiesService.getSalaryGroupDetail(req, res);
});

router.post(
  '/:company_id/salary-group/',
  [
    body('*.salary_name')
      .exists()
      .not()
      .isEmpty()
      .withMessage('salary name could not be empty'),
    body('*.salary_type')
      .exists()
      .not()
      .isEmpty()
      .withMessage('salary type could not be empty'),
    body('*.salary')
      .exists()
      .not()
      .isEmpty()
      .withMessage('salary could not be empty')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    companiesService.createSalaryGroup(req, res);
  }
);

router.get('/:company_id/details', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  companiesService.getDetail(req, res);
});

router.patch('/:salary_group_id/salary-group', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  companiesService.editSalaryGroup(req, res);
});

router.get('/:company_id/presences/:presence_id', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  presenceService.get(req, res);
});

module.exports = router;

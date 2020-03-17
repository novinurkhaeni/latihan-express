require('module-alias/register');
const { response } = require('@helpers');
const { companiesService, dashboardService } = require('@services/v4');
const express = require('express');
const { validationResult, query, body, param } = require('express-validator/check');
const router = express.Router();

router.get(
  '/:company_id/summary',
  [
    query('start', 'failed need query start date').exists(),
    query('end', 'failed need query end date').exists(),
    query('dateInfo', 'failed need query info date').exists()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    dashboardService.get(req, res);
  }
);

router.get('/:company_id/schedules/shift', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  companiesService.shiftService.getShift(req, res);
});

router.get('/:company_id/submission/presence', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  let service = new companiesService.presenceSubmission(req, res);
  service.getPresenceSubmission();
});

router.patch(
  '/:companyId/renew',
  [
    body('*.renew', 'renew should not be empty')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    companiesService.companyService.patchRenewCompany(req, res);
  }
);

router.patch(
  '/:company_ids/ability',
  [
    param('company_ids', 'company_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.companyAbility(req, res);
    service.editCompaniesAbilities();
  }
);

router.delete(
  '/:company_id',
  [
    param('company_id', 'company_id id required')
      .exists()
      .isNumeric()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    companiesService.shiftService.deleteCompanyBranch(req, res);
  }
);

router.get(
  '/:company_id/schedule',
  param('company_id', 'company_id id required')
    .exists()
    .not()
    .isEmpty(),
  query('date', 'failed need query date').exists(),
  query('date', 'query date cannot be empty')
    .not()
    .isEmpty(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    let service = new companiesService.ListingSchedulePresence(req, res);
    service.getListingSchedulePresence();
  }
);

router.get(
  '/:company_id/submission/history',
  [
    param('company_id', 'company_id required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    companiesService.submissionHistory.getSubmissionHistory(req, res);
  }
);
module.exports = router;

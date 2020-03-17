require('module-alias/register');
const { response } = require('@helpers');
const { transactionsService } = require('@services/v3');
const express = require('express');
const router = express.Router();
const { validationResult, body, query, param } = require('express-validator/check');

router.get(
  '/payment',
  [
    query('type')
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
    transactionsService.nicepay.getNicepayCcStatus(req, res);
  }
);

router.post(
  '/nicepay/cc/non-reccuring',
  [
    body('currency')
      .exists()
      .not()
      .isEmpty()
      .withMessage('currency could not be empty'),
    body('amount')
      .exists()
      .not()
      .isEmpty()
      .withMessage('amount could not be empty'),
    body('goods_name')
      .exists()
      .not()
      .isEmpty()
      .withMessage('goods_name could not be empty'),
    body('id_description')
      .exists()
      .not()
      .isEmpty()
      .withMessage('id_description could not be empty'),
    body('en_description')
      .exists()
      .not()
      .isEmpty()
      .withMessage('en_description could not be empty'),
    body('type')
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
    transactionsService.nicepay.ccNonReccuring(req, res);
  }
);

router.post(
  '/bca/va',
  body('*.employee_id')
    .exists()
    .not()
    .isEmpty()
    .withMessage('employee_id could not be empty'),
  body('*.total_amount')
    .exists()
    .not()
    .isEmpty()
    .withMessage('total_amount could not be empty'),
  body('*.type')
    .exists()
    .not()
    .isEmpty()
    .withMessage('type could not be empty'),
  body('*.id_description')
    .exists()
    .not()
    .isEmpty()
    .withMessage('id_description could not be empty'),
  body('*.en_description')
    .exists()
    .not()
    .isEmpty()
    .withMessage('en_description could not be empty'),
  body('*.payment_method')
    .exists()
    .not()
    .isEmpty()
    .withMessage('payment_method could not be empty'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    transactionsService.bca.createVaTransaction(req, res);
  }
);

router.post(
  '/bca/mt',
  body('*.employee_id')
    .exists()
    .not()
    .isEmpty()
    .withMessage('employee_id could not be empty'),
  body('*.total_amount')
    .exists()
    .not()
    .isEmpty()
    .withMessage('total_amount could not be empty'),
  body('*.type')
    .exists()
    .not()
    .isEmpty()
    .withMessage('type could not be empty'),
  body('*.id_description')
    .exists()
    .not()
    .isEmpty()
    .withMessage('id_description could not be empty'),
  body('*.en_description')
    .exists()
    .not()
    .isEmpty()
    .withMessage('en_description could not be empty'),
  body('*.payment_method')
    .exists()
    .not()
    .isEmpty()
    .withMessage('payment_method could not be empty'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    transactionsService.bca.createMtTransaction(req, res);
  }
);

router.get(
  '/history',
  [
    query('type')
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
    transactionsService.transaction.history(req, res);
  }
);

router.post(
  '/bca/mt',
  [
    body('*.amount')
      .exists()
      .not()
      .isEmpty()
      .withMessage('amount could not be empty'),
    body('*.id_description')
      .exists()
      .not()
      .isEmpty()
      .withMessage('id_description could not be empty'),
    body('*.en_description')
      .exists()
      .not()
      .isEmpty()
      .withMessage('en_description could not be empty'),
    body('*.type')
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
    transactionsService.transaction.manualTransfer(req, res);
  }
);

router.get(
  '/:transactionId/status',
  [
    param('transactionId', 'transactionId required')
      .exists()
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    transactionsService.transaction.checkStatus(req, res);
  }
);

module.exports = router;

require('module-alias/register');
const { vaService } = require('@services/v1');
const express = require('express');
const router = express.Router();
const { validationResult, body } = require('express-validator/check');

router.post(
  '/bills',
  [
    body('CompanyCode', 'CompanyCode required')
      .exists()
      .not()
      .isEmpty(),
    body('CustomerNumber', 'CustomerNumber required')
      .exists()
      .not()
      .isEmpty(),
    body('RequestID', 'RequestID required')
      .exists()
      .not()
      .isEmpty(),
    body('ChannelType', 'ChannelType required')
      .exists()
      .not()
      .isEmpty(),
    body('TransactionDate', 'TransactionDate required')
      .exists()
      .isLength({ min: 19 })
      .withMessage('must be at least 19 chars long')
    // .matches(
    //   /^(0?[1-9]|[12][0-9]|3[01])(\/)(0?[1-9]|1[0-2])(\/)\d\d\d\d (00|[0-9]|1[0-9]|2[0-3]):([0-9]|[0-5][0-9]):([0-9]|[0-5][0-9])$/g,
    //   'i'
    // )
    // .withMessage('Wrong TransactionDate format')
  ],
  (req, res) => {
    const { CompanyCode, CustomerNumber, RequestID } = req.body;
    const errors = validationResult(req);
    const responses = {
      CompanyCode,
      CustomerNumber,
      RequestID,
      CustomerName: 'n/a',
      CurrencyCode: 'IDR',
      TotalAmount: 0,
      SubCompany: '00000',
      FreeTexts: [],
      AdditionalData: '',
      InquiryStatus: '01',
      InquiryReason: {
        Indonesian: errors
          .array()
          .map(val => val.msg)
          .toString(),
        English: errors
          .array()
          .map(val => val.msg)
          .toString()
      },
      DetailBills: []
    };
    if (!errors.isEmpty()) {
      return res.status(422).json(responses);
    }
    vaService.bill(req, res);
  }
);

router.post(
  '/payments',
  [
    body('CompanyCode', 'CompanyCode required')
      .exists()
      .not()
      .isEmpty(),
    body('CustomerNumber', 'CustomerNumber required')
      .exists()
      .not()
      .isEmpty(),
    body('RequestID', 'RequestID required')
      .exists()
      .not()
      .isEmpty(),
    body('SubCompany', 'SubCompany required')
      .exists()
      .not()
      .isEmpty(),
    body('Reference', 'Reference required')
      .exists()
      .not()
      .isEmpty(),
    body('ChannelType', 'ChannelType required')
      .exists()
      .not()
      .isEmpty(),
    body('CustomerName', 'CustomerName required')
      .exists()
      .not()
      .isEmpty(),
    body('CurrencyCode', 'CurrencyCode required')
      .exists()
      .not()
      .isEmpty(),
    body('PaidAmount', 'PaidAmount required')
      .exists()
      .not()
      .isEmpty(),
    body('TotalAmount', 'TotalAmount required')
      .exists()
      .not()
      .isEmpty(),
    body('TransactionDate', 'TransactionDate required')
      .exists()
      .isLength({ min: 19 })
      .withMessage('must be at least 19 chars long'),
    // .matches(
    //   /^(0?[1-9]|[12][0-9]|3[01])(\/)(0?[1-9]|1[0-2])(\/)\d\d\d\d (00|[0-9]|1[0-9]|2[0-3]):([0-9]|[0-5][0-9]):([0-9]|[0-5][0-9])$/g,
    //   'i'
    // )
    // .withMessage('Wrong TransactionDate format'),
    body('FlagAdvice', 'FlagAdvice required')
      .exists()
      .not()
      .isEmpty()
      .isIn(['N', 'Y'])
      .withMessage('Wrong FlagEdvice input')
  ],
  (req, res) => {
    const { CompanyCode, CustomerNumber, RequestID, PaidAmount, TransactionDate } = req.body;
    const errors = validationResult(req);
    const responses = {
      CompanyCode,
      CustomerNumber,
      RequestID,
      CustomerName: 'n/a',
      CurrencyCode: 'IDR',
      PaidAmount,
      TotalAmount: '0.00',
      TransactionDate,
      DetailBills: [],
      FreeTexts: [],
      AdditionalData: '',
      PaymentFlagStatus: '01',
      PaymentFlagReason: {
        Indonesian: errors
          .array()
          .map(val => val.msg)
          .toString(),
        English: errors
          .array()
          .map(val => val.msg)
          .toString()
      }
    };
    if (!errors.isEmpty()) {
      return res.status(422).json(responses);
    }
    vaService.payment(req, res);
  }
);

module.exports = router;

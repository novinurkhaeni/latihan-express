require('module-alias/register');
const { response } = require('@helpers');
const { feedbackConversationService, feedbackService } = require('@services/v1');
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator/check');
/*
 * Feedback
 */
router.get('/', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(response(false, errors.array()));
  }
  feedbackService.get(req, res);
});

router.post(
  '/',
  [
    body('*.summary', 'feedback summary required')
      .exists()
      .trim(),
    body('*.message', 'feedback message required')
      .exists()
      .not()
      .isEmpty()
      .trim()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    feedbackService.create(req, res);
  }
);

/*
 * Feedback Conversation
 */
router.post(
  '/:feedback_id/conversation',
  [
    body('*.message', 'your message can not be empty')
      .exists()
      .not()
      .isEmpty()
      .trim()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(response(false, errors.array()));
    }
    feedbackConversationService.create(req, res);
  }
);

module.exports = router;

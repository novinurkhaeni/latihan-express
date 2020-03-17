require('module-alias/register');
const { response } = require('@helpers');
const {
  feedback_conversations: FeedbackConversation,
  feedbacks: Feedback,
  employees: Employee
} = require('@models');

const feedbackConversationService = {
  get: async (req, res) => {
    const { id: feedback_id } = req.params;
    try {
      const feedback = await FeedbackConversation.findAll({
        where: { id: feedback_id }
      });
      if (feedback === null) {
        return res
          .status(422)
          .json(response(false, `FeedbackConversation with id ${feedback_id} not found`));
      }
      return res
        .status(200)
        .json(response(true, 'Feedback Conversation retrieved successfully', feedback));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  create: async (req, res) => {
    const { id: userId } = res.local.users;
    const { data } = req.body;
    const { feedback_id } = req.params;
    try {
      const employee = await Employee.findOne({ where: { user_id: userId } });
      if (!employee) {
        return res
          .status(422)
          .json(response(false, `Employee data with user id ${userId} not found`));
      }
      const feedback = await Feedback.findOne({
        where: { id: feedback_id }
      });
      if (!feedback) {
        return res.status(422).json(response(true, `Feedback with id ${feedback_id} is not found`));
      }
      const payload = Object.assign(
        {},
        {
          feedback_id: feedback_id,
          commentable_id: userId,
          commentable_type: 'users',
          body: data.message
        }
      );
      let feedbackConversation = await FeedbackConversation.create(payload);
      if (feedbackConversation) {
        const feedback = await FeedbackConversation.findAll({
          where: { feedback_id }
        });
        return res.status(200).json(response(true, 'Message sent', feedback));
      }
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = feedbackConversationService;

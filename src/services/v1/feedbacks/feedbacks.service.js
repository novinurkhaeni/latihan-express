require('module-alias/register');
const { Sequelize } = require('sequelize');
const { response, dateConverter } = require('@helpers');
const {
  sequelize,
  feedbacks: Feedback,
  feedback_conversations: FeedbackConversation,
  employees: Employee,
  users: User
} = require('@models');

const feedbackService = {
  get: async (req, res) => {
    const { id: userId } = res.local.users;
    try {
      const employee = await Employee.findOne({
        where: { user_id: userId }
      });
      if (!employee) {
        return res
          .status(422)
          .json(response(false, `Employee data with user id ${userId} not found`));
      }
      const feedbacks = await Feedback.findAll({
        where: { employee_id: employee.id },
        include: [
          {
            model: FeedbackConversation,
            as: 'conversations',
            include: [{ model: User, attributes: ['full_name'] }]
          }
        ]
      });

      if (!feedbacks) {
        return res
          .status(422)
          .json(response(false, `Feedbacks data with employee id ${employee.id} not found`));
      }

      return res
        .status(200)
        .json(response(true, 'Feedbacks has been successfully retrieved', feedbacks, null));
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
    const today = new Date(new Date().setHours(new Date().getHours() + 7));
    const transaction = await sequelize.transaction();
    try {
      const employee = await Employee.findOne({ where: { user_id: userId } });
      if (!employee) {
        return res
          .status(422)
          .json(response(false, `Employee data with user id ${userId} not found`));
      }

      const totalTodayFeedbacks = await Feedback.findAll({
        where: [
          {},
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
            dateConverter(today)
          )
        ]
      });
      const totalFeedbacks = `${'0'.repeat(
        5 - totalTodayFeedbacks.length.toString().length
      )}${totalTodayFeedbacks.length + 1}`;
      const feedbackId = `${today.getDate()}${today.getMonth()}${today.getFullYear()}${totalFeedbacks}`;

      const feedback = await Feedback.create(
        {
          id: feedbackId,
          employee_id: employee.id,
          summary: data.summary
        },
        { transaction }
      );

      if (!feedback) {
        await transaction.rollback();
        return res.status(400).json(response(true, 'Failed to create feedback'));
      }

      const feedbackConv = await FeedbackConversation.create(
        {
          feedback_id: feedback.id,
          commentable_id: userId,
          commentable_type: 'users',
          body: data.message
        },
        { transaction }
      );

      if (!feedbackConv) {
        await transaction.rollback();
        return res.status(400).json(response(true, 'Failed to create feedback'));
      }
      await transaction.commit();
      return res
        .status(200)
        .json(response(true, 'Feedback has been successfully created', feedback, null));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = feedbackService;

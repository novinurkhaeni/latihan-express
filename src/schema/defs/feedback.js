const { gql } = require('apollo-server-express');
const { feedbacks: Feedback, feedback_conversations: FeedbackConversations } = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');
const employeeDefs = require('./employee');

/**
 * Feedback Graphql Defs
 */

// TypeDef of Feedback
const typeDef = gql`
  extend type Query {
    feedback(id: Int!): Feedback!
    feedbacks(limit: Int, offset: Int, id: Int): [Feedback]!
  }

  extend type Mutation {
    updateStatusFeedback(id: Int!, status: String): Feedback!
  }

  type Feedback {
    id: Int
    employee_id: Int
    employee: Employee
    summary: String
    status: String
    created_at: String
    updated_at: String
    feedbackConversations: [FeedbackConversations]!
  }
`;

// Feedback Resolvers
const resolvers = {
  Query: {
    feedback: async (root, { id }) => {
      try {
        const result = await Feedback.findOne({ where: { id } });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    feedbacks: async (root, param) => {
      const { limit, offset } = param;
      try {
        return await Feedback.all({
          limit,
          offset,
          order: [['created_at', 'DESC']]
        });
      } catch (err) {
        dbError(err);
      }
    }
  },
  Mutation: {
    updateStatusFeedback: async (root, params) => {
      const { id } = params;
      try {
        const update = await Feedback.update(params, {
          where: { id }
        });
        if (update > 0) {
          const result = await Feedback.findOne({ where: { id } });
          return result;
        }
        throw new Error(`Error update status feedback with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    }
  },
  Feedback: {
    employee: async root => {
      const { employee_id } = root;
      try {
        if (employee_id > 0) {
          const result = await employeeDefs.resolvers.Query.employee(root, {
            id: employee_id
          });
          return result;
        }
      } catch (error) {
        dbError(error);
      }
    },
    feedbackConversations: async (root, params) => {
      try {
        const result = await FeedbackConversations.findAll({
          where: { feedback_id: root.id }
        });
        return result;
      } catch (error) {
        dbError(error);
      }
    }
  }
};

module.exports = {
  typeDef,
  resolvers
};

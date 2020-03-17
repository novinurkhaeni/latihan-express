const { gql } = require('apollo-server-express');
const { feedback_conversations: FeedbackConversations } = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');

/**
 * Feedback Graphql Defs
 */

// TypeDef of Feedback
const typeDef = gql`
  extend type Query {
    feedbackConversations(feedback_id: Int!): FeedbackConversations!
  }

  extend type Mutation {
    replyFeedback(
      id: Int
      feedback_id: Int!
      commentable_id: Int!
      commentable_type: String!
      body: String!
      created_at: String
      updated_at: String
    ): FeedbackConversations!
  }

  type FeedbackConversations {
    id: Int
    feedback_id: Int
    commentable_id: Int
    commentable_type: String
    body: String
    created_at: String
    updated_at: String
  }
`;

// Feedback Resolvers
const resolvers = {
  Query: {
    feedbackConversations: async (root, { id }) => {
      try {
        const result = await FeedbackConversations.findAll({
          where: { feedback_id: root.id }
        });
        return result;
      } catch (error) {
        dbError(error);
      }
    }
  },
  Mutation: {
    replyFeedback: async (root, params) => {
      try {
        const reply = FeedbackConversations.create(params);
        if (reply) {
          return reply;
        }
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

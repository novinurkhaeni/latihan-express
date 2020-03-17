const { gql } = require('apollo-server-express');
const { logs: Log } = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');

//TypeDef of Logs
const typeDef = gql`
  extend type Query {
    log(id: Int!): Log!
    logs: [Log]!
  }
  type Log {
    id: Int
    platform: String
    company: String
    description: String
    created_at: String
  }
`;

//Logs resolver
const resolvers = {
  Query: {
    log: async (root, { id }) => {
      try {
        const result = await Log.findOne({ where: { id } });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    logs: async (root, params) => {
      const { limit, offset } = params;
      try {
        return await Log.all({ offset, limit });
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

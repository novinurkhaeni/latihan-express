const { gql } = require('apollo-server-express');
const { ptkp: Ptkp } = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');

const typeDef = gql`
  extend type Query {
    ptkps: [Ptkp]!
    ptkp(id: ID!): Ptkp!
  }

  extend type Mutation {
    createPtkp(name: String!): Ptkp!
    updatePtkp(id: Int!, name: String!): Ptkp!
    deletePtkp(id: Int!): String!
  }

  type Ptkp {
    id: Int
    name: String
    created_at: String
    updated_at: String
  }
`;

const resolvers = {
  Query: {
    ptkp: async (root, { id }) => {
      try {
        const result = await Ptkp.findById(id);
        if (!result) {
          throw new Error('Id not found');
        }
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    ptkps: async (root, params) => {
      const { limit, offset } = params;
      try {
        return await Ptkp.all({ offset, limit });
      } catch (error) {
        dbError(error);
      }
    }
  },
  Mutation: {
    createPtkp: async (root, params) => {
      try {
        const ptkp = await Ptkp.create(params);
        if (ptkp) {
          return ptkp;
        }
      } catch (error) {
        dbError(error);
      }
    },
    updatePtkp: async (root, params) => {
      const { id } = params;
      try {
        const updatePtkp = await Ptkp.update(params, { where: { id } });
        if (updatePtkp > 0) {
          const result = await updatePtkp.findOne({ where: { id } });
          return result;
        }
        throw new Error(`Error update PTKP with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    },
    deletePtkp: async (root, { id }) => {
      try {
        const deletedPtkp = await Ptkp.destroy({ where: { id } });
        if (deletedPtkp !== 0) {
          return `PTKP with id ${id} was deleted!`;
        }
        throw new Error(`Error deleting PTKP with id ${id}`);
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

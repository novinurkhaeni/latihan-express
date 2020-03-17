const { gql } = require('apollo-server-express');
const { promos: Promo } = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');
/**
 * Promo Graphql Defs
 */

// TypeDef of Promo
const typeDef = gql`
  extend type Query {
    promo(id: Int!): Promo!
    promos(offset: Int, limit: Int): [Promo]!
  }

  extend type Mutation {
    createPromo(
      code: String!
      type: String!
      amount: Int!
      expired_date: String!
      limit: Int!
    ): Promo!
    updatePromo(
      id: Int!
      code: String
      type: String
      amount: Int
      expired_date: String
      limit: Int
    ): Promo!
    deletePromo(id: Int!): String!
  }

  type Promo {
    id: Int
    code: String
    type: String
    amount: Int
    expired_date: String
    limit: Int
    usage: Int
  }
`;

// Promo Resolvers
const resolvers = {
  Query: {
    promo: async (root, { id }) => {
      try {
        const result = await Promo.findOne({ where: { id } });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    promos: async (root, params) => {
      const { limit, offset } = params;
      try {
        return await Promo.all({ offset, limit });
      } catch (error) {
        dbError(error);
      }
    }
  },
  Mutation: {
    createPromo: async (root, params) => {
      try {
        const promo = Promo.create(params);
        if (promo) {
          return promo;
        }
      } catch (error) {
        dbError(error);
      }
    },
    updatePromo: async (root, params) => {
      const { id } = params;
      try {
        const updatePromo = await Promo.update(params, { where: { id } });
        if (updatePromo > 0) {
          const result = await Promo.findOne({ where: { id } });
          return result;
        }
        throw new Error(`Error update promo code with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    },
    deletePromo: async (root, { id }) => {
      try {
        const deletedPromo = await Promo.destroy({ where: { id } });
        if (deletedPromo !== 0) {
          return `Promo code with id ${id} was deleted!`;
        }
        throw new Error(`Error deleting promo code with id ${id}`);
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

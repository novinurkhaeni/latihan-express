const { gql } = require('apollo-server-express');

const { gajiandulu_data: GajianDuluModel } = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');

/**
 * GajianDulu-Data Graphql Defs
 */

// TypeDef of GajianDulu-Data
const typeDef = gql`
  extend type Query {
    gdData(id: Int!): GajianDuluData!
    gdDatas: [GajianDuluData]!
  }
  extend type Mutation {
    createGajianDulu(
      bank_owner: String!
      bank_name: Int!
      account_number: String!
      bank_branch: String!
      type: Int!
      email: String!
    ): GajianDuluData!
    updateGajianDulu(
      id: Int!
      bank_owner: String
      bank_name: Int
      account_number: String
      bank_branch: String
      type: Int
      email: String
    ): GajianDuluData!
    deleteGajianDulu(id: Int!): String!
  }

  type GajianDuluData {
    id: Int
    bank_owner: String
    bank_name: Int
    account_number: String
    bank_branch: String
    type: Int
    email: String
  }
`;

// GajianDulu-Data Resolvers
const resolvers = {
  Query: {
    gdData: async (root, { id }) => {
      try {
        const result = await GajianDuluModel.findOne({ where: { id } });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    gdDatas: async () => await GajianDuluModel.all()
  },
  Mutation: {
    createGajianDulu: async (root, params) => {
      try {
        const GajianDulu = GajianDuluModel.create(params);
        if (GajianDulu) {
          return GajianDulu;
        }
      } catch (error) {
        dbError(error);
      }
    },
    updateGajianDulu: async (root, params) => {
      const { id } = params;
      try {
        const updateGajianDulu = await GajianDuluModel.update(params, {
          where: { id }
        });
        if (updateGajianDulu > 0) {
          const result = await GajianDuluModel.findOne({ where: { id } });
          return result;
        }
        throw new Error(`Error update GajianDulu-Data with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    },
    deleteGajianDulu: async (root, { id }) => {
      try {
        const deleteGajianDulu = await GajianDuluModel.destroy({
          where: { id }
        });
        if (deleteGajianDulu !== 0) {
          return `GajianDulu-Data with id ${id} was deleted!`;
        }
        throw new Error(`Error deleting GajianDulu-Data with id ${id}`);
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

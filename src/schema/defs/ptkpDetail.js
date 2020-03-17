const { gql } = require('apollo-server-express');
const { ptkp_details: PtkpDetail } = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');

const typeDef = gql`
  extend type Query {
    ptkpDetails(ptkp_id: Int!): [PtkpDetail]!
  }

  extend type Mutation {
    createPtkpDetail(name: String!, amount: Int!, ptkp_id: Int!): PtkpDetail!
    updatePtkpDetail(id: Int!, name: String!, amount: Int!): PtkpDetail!
    deletePtkpDetail(id: Int!): String!
  }

  type PtkpDetail {
    id: Int
    name: String
    amount: Int
    created_at: String
    updated_at: String
  }
`;

const resolvers = {
  Query: {
    ptkpDetails: async (root, params) => {
      const { limit, offset } = params;
      try {
        const ptkpDetails = await PtkpDetail.all({
          offset,
          limit,
          where: { ptkp_id: params.ptkp_id }
        });
        return ptkpDetails;
      } catch (error) {
        dbError(error);
      }
    }
  },
  Mutation: {
    createPtkpDetail: async (root, params) => {
      try {
        const ptkpDetail = await PtkpDetail.create(params);
        if (ptkpDetail) {
          return ptkpDetail;
        }
      } catch (error) {
        dbError(error);
      }
    },
    updatePtkpDetail: async (root, params) => {
      const { id } = params;
      try {
        const updatePtkpDetail = await PtkpDetail.update(params, { where: { id } });
        if (updatePtkpDetail > 0) {
          const result = await updatePtkpDetail.findOne({ where: { id } });
          return result;
        }
        throw new Error(`Error update PTKP Detail with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    },
    deletePtkpDetail: async (root, { id }) => {
      try {
        const deletedPtkpDetail = await PtkpDetail.destroy({ where: { id } });
        if (deletedPtkpDetail !== 0) {
          return `PTKP Detail with id ${id} was deleted!`;
        }
        throw new Error(`Error deleting PTKP Detail with id ${id}`);
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

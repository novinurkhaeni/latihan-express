const { gql } = require('apollo-server-express');
const {
  journal_details: JournalDetail,
  digital_assets: DigitalAsset,
  promos: Promo
} = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');
/**
 * JournalDetail Graphql Defs
 */

// TypeDef of JournalDetail
const typeDef = gql`
  extend type Query {
    journalDetail(id: Int!): JournalDetail!
    journalDetails(limit: Int, offset: Int): [JournalDetail]!
  }

  extend type Mutation {
    updateJournalDetail(
      id: Int!
      journal_id: Int
      tax: Int
      fee: Int
      promo_id: Int
      promo_applied: Int
      total: Int
      total_nett: Int
      status: Int
    ): JournalDetail!
    createJournalDetail(
      journal_id: Int!
      tax: Int
      fee: Int
      promo_id: Int
      promo_applied: Int
      total: Int
      total_nett: Int
      status: Int
    ): JournalDetail!
    deleteJournalDetail(id: Int!): String!
    updateStatusJournalDetails(id: Int!, status: Int): JournalDetail!
  }

  type JournalDetail {
    id: Int
    journal_id: Int
    tax: Int
    fee: Int
    promo_id: Int
    promo_applied: Int
    promo: String
    total: Int
    total_nett: Int
    status: Int
    last_salary: Int
    assets: [Asset]
    created_at: String
    updated_at: String
  }

  type Asset {
    url: String
    type: String
  }
`;

// JournalDetail Resolvers
const resolvers = {
  Query: {
    journalDetail: async (root, { id }) => {
      try {
        const result = await JournalDetail.findOne({
          where: { id },
          include: {
            model: DigitalAsset,
            required: false,
            attributes: ['url', 'type'],
            where: {
              type: 'withdraw'
            },
            as: 'assets'
          }
        });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    journalDetails: async (root, params) => {
      const { type, limit, offset } = params;
      try {
        const result = type
          ? await JournalDetail.findAll({ where: { type }, limit, offset })
          : await JournalDetail.all({ limit, offset });
        return result;
      } catch (error) {
        dbError(error);
      }
    }
  },
  JournalDetail: {
    promo: async root => {
      const { promo_id } = root;
      try {
        if (!promo_id) {
          return null;
        }
        const result = await Promo.findOne({ where: { id: promo_id }, attributes: ['code'] });
        return result.code;
      } catch (error) {
        dbError(error);
      }
    }
  },
  Mutation: {
    updateJournalDetail: async (root, params) => {
      const { id } = params;
      try {
        const updatedJournalDetail = await JournalDetail.update(params, {
          where: { id }
        });
        if (updatedJournalDetail > 0) {
          const result = await JournalDetail.findOne({ where: { id } });
          return result;
        }
        throw new Error(`Error update JournalDetail with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    },
    createJournalDetail: async (root, params) => {
      try {
        const newJournalDetail = await JournalDetail.create(params);
        if (newJournalDetail) {
          return newJournalDetail;
        }
      } catch (error) {
        dbError(error);
      }
    },
    deleteJournalDetail: async (root, params) => {
      const { id } = params;
      try {
        const deletedJournalDetail = await JournalDetail.destroy({
          where: { id }
        });
        if (deletedJournalDetail !== 0) {
          return `JournalDetail with id ${id} was deleted!`;
        }
        throw new Error(`Error deleting Employee with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    },
    updateStatusJournalDetails: async (root, params) => {
      return 'Useless Graphql';
    }
  }
};

module.exports = {
  typeDef,
  resolvers
};

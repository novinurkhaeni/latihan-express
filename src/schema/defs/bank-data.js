const { gql } = require('apollo-server-express');
const Sequelize = require('sequelize');
const { bank_data: BankData } = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');
const userDefs = require('./user');
const { Op } = Sequelize;

/**
 * BankData Graphql Defs
 */

// TypeDef of BankData

const typeDef = gql`
  extend type Query {
    bankData(id: Int!): BankDataList!
    bankDatas(active: Boolean!, limit: Int, offset: Int): [BankDataList]!
    search_bank_list(active: Boolean!, search: String!): [BankDataList]!
  }

  extend type Mutation {
    updateBankData(
      id: Int!
      full_name: String
      bank_name: String
      bank_branch: String
      account_number: String
      active: Boolean
      user_id: Int!
    ): BankDataList!
    deleteBankData(id: Int!): String!
  }

  type BankDataList {
    id: Int
    full_name: String
    bank_name: String
    bank_branch: String
    account_number: String
    active: Boolean
    user_id: Int
    user: User
    count: Int
  }
`;

// BankData Resolvers
const resolvers = {
  Query: {
    bankData: async (root, { id }) => {
      try {
        const result = await BankData.findOne({ where: { id } });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    bankDatas: async (root, { active, limit, offset }) => {
      return await BankData.all({ where: { active }, limit, offset });
    },
    search_bank_list: async (root, params) => {
      const { active, search } = params;
      try {
        return await BankData.all({
          where: {
            active,
            [Op.or]: [
              {
                full_name: {
                  [Op.like]: '%' + search + '%'
                }
              },
              {
                bank_name: {
                  [Op.like]: '%' + search + '%'
                }
              },
              {
                account_number: {
                  [Op.like]: '%' + search + '%'
                }
              }
            ]
          }
        });
      } catch (error) {
        dbError(error);
      }
    }
  },
  Mutation: {
    updateBankData: async (root, params) => {
      const { id, user_id } = params;
      try {
        if (params.active) {
          const findBankActive = await BankData.findAll({
            where: { user_id, active: 1, id: { [Op.ne]: id } }
          });
          if (findBankActive.length > 0) {
            throw new Error('There is another bank account that has status active');
          }
        }
        const updateBankData = await BankData.update(params, {
          where: { id }
        });
        if (updateBankData > 0) {
          const result = await BankData.findOne({ where: { id } });
          return result;
        }
        throw new Error(`Error update Bank Data with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    },

    deleteBankData: async (root, { id }) => {
      try {
        const deleteBankData = await BankData.destroy({
          where: { id }
        });
        if (deleteBankData !== 0) {
          return `Bank Data with id ${id} was deleted!`;
        }
        throw new Error(`Error deleting Bank Data with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    }
  },
  BankDataList: {
    user: async root => {
      const { user_id } = root;
      try {
        if (user_id > 0) {
          const result = await userDefs.resolvers.Query.user(root, {
            id: user_id
          });
          return result;
        }
      } catch (error) {
        dbError(error);
      }
    },
    count: async root => {
      const { active } = root;
      try {
        const all = await BankData.all({ where: { active } });
        const bankDataLength = all.length;
        return bankDataLength;
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

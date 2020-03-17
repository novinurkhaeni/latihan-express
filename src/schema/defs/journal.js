const { gql } = require('apollo-server-express');
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const {
  journals: Journal,
  journal_details: JournalDetail,
  digital_assets: DigitalAsset,
  employees: Employee
} = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');
const employeeDefs = require('./employee');
/**
 * Journal Graphql Defs
 */

// TypeDef of Journal
const typeDef = gql`
  extend type Query {
    journal(id: Int!): Journal!
    journals(limit: Int, offset: Int, type: String, orderBy: String, orderType: String): [Journal]!
    journalCompany(company_id: Int!): JournalCompany
  }

  extend type Mutation {
    updateJournal(
      id: Int!
      employee_id: Int
      type: String
      debet: Int
      kredit: Int
      description: String!
    ): Journal!
    createJournal(
      employee_id: Int!
      type: String!
      debet: Int
      kredit: Int
      description: String
    ): Journal!
    deleteJournal(id: Int!): String!
    balancingJournal(
      balanceType: String!
      debet: Int!
      employee_id: Int!
      description: String
      balance: Int!
    ): Journal!
  }

  type Journal {
    id: Int
    employee_id: Int
    employee: Employee
    type: String
    debet: Int
    kredit: Int
    description: String
    details: JournalDetail
    jurnalDetails: [JournalDetail]
    created_at: String
    updated_at: String
  }

  type JournalCompany {
    totalDebetCredit: Int
  }
`;

// Journal Resolvers
const resolvers = {
  Query: {
    journal: async (root, { id }) => {
      try {
        const result = await Journal.findOne({ where: { id } });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    journals: async (root, params) => {
      const { type, limit, offset, orderBy, orderType } = params;
      /* eslint-disable indent */
      try {
        const result = type
          ? await Journal.findAll({
              where: { type },
              limit,
              offset,
              order: [[orderBy, orderType]]
            })
          : await Journal.all({ limit, offset, order: [[orderBy, orderType]] });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    journalCompany: async (root, params) => {
      const { company_id } = params;
      try {
        // Find Latest Payment that Truely Balancing Journal
        const balanceDate = await Journal.findOne({
          attributes: [[Sequelize.fn('max', Sequelize.col('journals.created_at')), 'created_at']],
          where: { balance: 1, type: 'payment' },
          include: { model: Employee, attributes: [], where: { company_id } },
          group: ['journals.employee_id', 'employee.id']
        });
        const getJournal = await Journal.findAll({
          where: [
            { type: ['subscribe', 'payment'] },
            balanceDate !== null && {
              created_at: {
                [Op.gt]: Sequelize.fn('DATE_FORMAT', balanceDate.created_at, '%Y-%m-%d %H:%i:%S')
              }
            }
          ],
          include: {
            model: Employee,
            where: { company_id, role: 1 }
          }
        });
        const getJournalDetail = await JournalDetail.findAll({
          where: { status: 1 },
          include: {
            model: Journal,
            where: [
              { type: ['withdraw'] },
              balanceDate !== null && {
                created_at: {
                  [Op.gt]: Sequelize.fn('DATE_FORMAT', balanceDate.created_at, '%Y-%m-%d %H:%i:%S')
                }
              }
            ],
            include: {
              model: Employee,
              where: { company_id }
            }
          }
        });

        let resultJournal = 0;
        let resultJournalDetail = 0;

        await getJournal.forEach(async data => {
          const sum = data.kredit - data.debet;
          return (resultJournal = resultJournal + sum);
        });
        await getJournalDetail.forEach(async data => {
          return (resultJournalDetail = resultJournalDetail + data.total);
        });
        return { totalDebetCredit: resultJournal + resultJournalDetail };
      } catch (error) {
        dbError(error);
      }
    }
  },
  Journal: {
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
    details: async root => {
      const { id, type } = root;
      try {
        if (type === 'withdraw') {
          const result = await JournalDetail.findOne({
            where: { journal_id: id },
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
        }
      } catch (error) {
        dbError(error);
      }
    },
    jurnalDetails: async root => {
      try {
        const result = await JournalDetail.findAll({
          where: { journal_id: root.id }
        });
        return result;
      } catch (error) {
        dbError(error);
      }
    }
  },
  Mutation: {
    updateJournal: async (root, params) => {
      const { id } = params;
      try {
        const updatedJournal = await Journal.update(params, { where: { id } });
        if (updatedJournal > 0) {
          const result = await Journal.findOne({ where: { id } });
          return result;
        }
        throw new Error(`Error update Journal with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    },
    createJournal: async (root, params) => {
      try {
        const newJournal = await Journal.create(params);
        if (newJournal) {
          return newJournal;
        }
      } catch (error) {
        dbError(error);
      }
    },
    deleteJournal: async (root, params) => {
      const { id } = params;
      try {
        const deletedJournal = await Journal.destroy({ where: { id } });
        if (deletedJournal !== 0) {
          return `Journal with id ${id} was deleted!`;
        }
        throw new Error(`Error deleting Employee with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    },
    balancingJournal: async (root, params) => {
      try {
        // @note: type 'manual' when admin input manually, and automatic when admin only click success payment button. type 'automatic' will release in next version
        if (params.balanceType === 'manual') {
          const newJournal = await Journal.create({
            employee_id: params.employee_id,
            type: 'payment',
            debet: params.debet,
            kredit: 0,
            description: params.description || `Pembayaran untuk service berlanganan`,
            balance: params.balance
          });
          if (newJournal) {
            return newJournal;
          }
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

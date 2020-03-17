const { gql } = require('apollo-server-express');
const Sequelize = require('sequelize');
const {
  journal_details: JournalDetails,
  bank_data: BankData,
  journals: Journal,
  employees: Employee,
  companies: Company,
  users: User,
  promos: Promo
} = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');

/**
 * Withdraw Graphql Defs
 */

// TypeDef of Withdraw

const typeDef = gql`
  extend type Query {
    withdrawHistory(year: String, month: String): [WithdrawHistory]!
  }

  extend type Mutation {
    deleteWithdraw(id: Int!): String!
  }

  type WithdrawHistory {
    id: Int
    journal_id: Int
    promo: String
    tax: Int
    fee: Int
    total: Int
    total_nett: Int
    status: Int
    created_at: String
    user_id: Int
    account_name: String
    bank: String
    branch: String
    account_number: String
    company_id: Int
    team_id: String
    company_active: Int
    employee_id: Int
    user_name: String
    salary: Int
    last_salary: Int
    daily_salary: Int
  }
`;

// Withdraw Resolvers
const resolvers = {
  Query: {
    withdrawHistory: async (root, params) => {
      try {
        const { year, month } = params;
        const withdrawList = await JournalDetails.findAll({
          order: [['created_at', 'DESC']],
          where: [
            { $not: { status: 0 } },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('journal_details.created_at'), '%Y-%c'),
              `${year}-${month}`
            )
          ],
          include: {
            model: Journal,
            attributes: ['employee_id'],
            include: {
              model: Employee,
              attributes: ['salary', 'daily_salary'],
              include: [
                {
                  model: Company,
                  attributes: ['id', 'codename', 'active']
                },
                {
                  model: User,
                  attributes: ['id', 'full_name'],
                  include: {
                    model: BankData,
                    where: { active: 1 },
                    attributes: ['full_name', 'bank_name', 'bank_branch', 'account_number']
                  }
                }
              ]
            }
          }
        });
        let withdrawArray = [];
        for (let i = 0; i < withdrawList.length; i++) {
          let promo = null;
          if (withdrawList[i].promo_id) {
            promo = await Promo.findOne({
              where: { id: withdrawList[i].promo_id }
            });
          }
          let objWithdraw = {
            id: withdrawList[i].id,
            journal_id: withdrawList[i].journal_id,
            promo: promo ? promo.code : null,
            tax: withdrawList[i].tax,
            fee: withdrawList[i].fee,
            total: withdrawList[i].total,
            total_nett: withdrawList[i].total_nett,
            status: withdrawList[i].status,
            created_at: withdrawList[i].created_at,
            user_id: withdrawList[i].journal.employee.user.id,
            account_name: withdrawList[i].journal.employee.user.bank_data[0].full_name,
            bank: withdrawList[i].journal.employee.user.bank_data[0].bank_name,
            branch: withdrawList[i].journal.employee.user.bank_data[0].bank_branch,
            account_number: withdrawList[i].journal.employee.user.bank_data[0].account_number,
            company_active: withdrawList[i].journal.employee.company.active,
            company_id: withdrawList[i].journal.employee.company.id,
            team_id: withdrawList[i].journal.employee.company.codename,
            employee_id: withdrawList[i].journal.employee_id,
            user_name: withdrawList[i].journal.employee.user.full_name,
            salary: withdrawList[i].journal.employee.salary,
            last_salary: withdrawList[i].last_salary,
            daily_salary: withdrawList[i].journal.employee.daily_salary
          };
          withdrawArray.push(objWithdraw);
        }
        return withdrawArray;
      } catch (error) {
        dbError(error);
      }
    }
  },
  Mutation: {
    deleteWithdraw: async (root, params) => {
      try {
        const { id } = params;
        let withdraw = Journal.findOne({ where: { id } });
        if (!withdraw) {
          throw new Error(`Tidak ada transaksi tarik gajian dengan id journal ${id}`);
        }
        withdraw = Journal.destroy({ where: { id } });
        if (withdraw !== 0) {
          return 'Sukses menghapus tarikan gajian dulu!';
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

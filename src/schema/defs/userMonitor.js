const { gql } = require('apollo-server-express');
const { Sequelize } = require('sequelize');
const {
  companies: Company,
  employees: Employee,
  presences: Presence,
  subscription_details: SubscriptionDetail,
  subscriptions: Subscription,
  users: User,
  journals: Journal,
  journal_details: JournalDetail
} = require('@models');
const {
  errorHandler: { dbError },
  dateHelper
} = require('@helpers');

const typeDef = gql`
  extend type Query {
    userActiveInCompany: [UserActiveInCompany]!
    subscribingCompany(year: String!): [SubscribingCompany]!
    totalCompany(year: String!): [TotalCompany]!
    totalEmployee(year: String!): [TotalEmployee]!
    totalActiveEmployee(year: String!): [TotalEmployee]!
    totalActiveCompany(year: String!): [TotalCompany]!
    totalWithdraw(year: String!, mode: String!): [TotalWithdrawer]!
    totalPresenceEmployee(year: String!): [TotalPresenceEmployee]!
  }
  type UserActiveInCompany {
    company_name: String
    total_employee: Int
    total_active_employee: Int
  }
  type SubscribingCompany {
    date: String
    basic_monthly: Int
    basic_yearly: Int
    perusahaan_monthly: Int
    perusahaan_yearly: Int
    total: Int
    company_lists: [Name]
  }
  type TotalCompany {
    date: String
    total: Int
    company_lists: [Name]
  }
  type TotalEmployee {
    date: String
    total: Int
    member_lists: [Name]
  }
  type TotalWithdrawer {
    date: String
    total: Int
    withdrawer_lists: [Withdrawer]
  }
  type TotalPresenceEmployee {
    date: String
    total: Int
  }
  type Name {
    name: String
  }
  type Withdrawer {
    name: String
    company: String
  }
`;

const resolvers = {
  Query: {
    totalWithdraw: async (root, { year, mode }) => {
      const withdraws = await Journal.findAll({
        where: [
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('journals.created_at'), '%Y'),
            year
          ),
          { type: 'withdraw' }
        ],
        order: [[Sequelize.col('journals.created_at'), 'ASC']],
        attributes: ['created_at'],
        include: [
          {
            model: Employee,
            attributes: ['id'],
            include: [
              { model: User, attributes: ['full_name'] },
              { model: Company, attributes: ['name', 'company_name'] }
            ]
          },
          {
            model: JournalDetail,
            attributes: [],
            required: true,
            where: mode !== 'All' ? { status: 1 } : null
          }
        ]
      });

      const dateConverter = date => {
        let result;
        const newDate = new Date(date);
        result = `${dateHelper[newDate.getMonth() + 1]} ${newDate.getFullYear()}`;
        return result;
      };
      let data = [];
      for (const withdraw of withdraws) {
        const date = dateConverter(withdraw.created_at);
        const index = data.findIndex(val => val.date === date);
        if (index === -1) {
          data.push({
            date,
            total: 1,
            withdrawer_lists: [
              {
                name: withdraw.employee.user.full_name,
                company: withdraw.employee.company.company_name || withdraw.employee.company.name
              }
            ]
          });
        } else {
          data[index].total += 1;
          data[index].withdrawer_lists.push({
            name: withdraw.employee.user.full_name,
            company: withdraw.employee.company.company_name || withdraw.employee.company.name
          });
        }
      }
      return data;
    },
    totalActiveCompany: async (root, { year }) => {
      try {
        const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        let companies = [];
        for (const month of months) {
          const data = await Company.findAll({
            attributes: ['created_at', 'company_name', 'name'],
            include: [
              {
                model: Employee,
                required: true,
                attributes: [],
                include: {
                  model: Presence,
                  attributes: [],
                  required: true,
                  where: Sequelize.where(
                    Sequelize.fn(
                      'DATE_FORMAT',
                      Sequelize.col('employees->presences.created_at'),
                      '%Y%c'
                    ),
                    `${year}${month}`
                  )
                }
              }
            ]
          });
          for (const company of data) {
            companies.push({ ...company, created_at: `${dateHelper[month]} ${year}` });
          }
        }
        let data = [];
        for (const company of companies) {
          const index = data.findIndex(val => val.date === company.created_at);
          if (index === -1) {
            data.push({
              date: company.created_at,
              total: 1,
              company_lists: [{ name: company.company_name || company.name }]
            });
          } else {
            data[index].total += 1;
            data[index].company_lists.push({ name: company.company_name || company.name });
          }
        }
        return data;
      } catch (error) {
        dbError(error);
      }
    },
    totalActiveEmployee: async (root, { year }) => {
      try {
        const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        let employees = [];
        for (const month of months) {
          const data = await Employee.findAll({
            attributes: ['created_at'],
            include: [
              { model: User, attributes: ['full_name'] },
              {
                model: Presence,
                attributes: [],
                required: true,
                where: Sequelize.where(
                  Sequelize.fn('DATE_FORMAT', Sequelize.col('presences.created_at'), '%Y%c'),
                  `${year}${month}`
                )
              }
            ]
          });
          for (const employee of data) {
            employees.push({ ...employee, created_at: `${dateHelper[month]} ${year}` });
          }
        }
        let data = [];
        for (const employee of employees) {
          const index = data.findIndex(val => val.date === employee.created_at);
          if (index === -1) {
            data.push({
              date: employee.created_at,
              total: 1,
              member_lists: [{ name: employee.user.full_name }]
            });
          } else {
            data[index].total += 1;
            data[index].member_lists.push({ name: employee.user.full_name });
          }
        }
        return data;
      } catch (error) {
        dbError(error);
      }
    },
    totalEmployee: async (root, { year }) => {
      try {
        const employees = await Employee.findAll({
          where: Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('employees.created_at'), '%Y'),
            year
          ),
          attributes: ['created_at'],
          include: { model: User, attributes: ['full_name'] }
        });

        const dateConverter = date => {
          let result;
          const newDate = new Date(date);
          result = `${dateHelper[newDate.getMonth() + 1]} ${newDate.getFullYear()}`;
          return result;
        };
        let data = [];
        for (const employee of employees) {
          const date = dateConverter(employee.created_at);
          const index = data.findIndex(val => val.date === date);
          if (index === -1) {
            data.push({
              date,
              total: 1,
              member_lists: [{ name: employee.user.full_name }]
            });
          } else {
            data[index].total += 1;
            data[index].member_lists.push({ name: employee.user.full_name });
          }
        }
        return data;
      } catch (error) {
        dbError(error);
      }
    },
    totalCompany: async (root, { year }) => {
      try {
        const companies = await Company.findAll({
          where: Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y'),
            year
          ),
          attributes: ['company_name', 'name', 'id', 'created_at']
        });
        const dateConverter = date => {
          let result;
          const newDate = new Date(date);
          result = `${dateHelper[newDate.getMonth() + 1]} ${newDate.getFullYear()}`;
          return result;
        };
        let data = [];
        for (const company of companies) {
          const date = dateConverter(company.created_at);
          const index = data.findIndex(val => val.date === date);
          if (index === -1) {
            data.push({
              date,
              total: 1,
              company_lists: [{ name: company.company_name || company.name }]
            });
          } else {
            data[index].total += 1;
            data[index].company_lists.push({ name: company.company_name || company.name });
          }
        }
        return data;
      } catch (error) {
        dbError(error);
      }
    },
    userActiveInCompany: async (root, { id }) => {
      try {
        const allEmployees = await Company.findAll({
          attributes: ['company_name', 'name', 'id'],
          include: {
            model: Employee,
            attributes: ['id']
          }
        });
        const activeEmployees = await Company.findAll({
          attributes: ['company_name', 'name', 'id'],
          include: {
            model: Employee,
            attributes: ['id'],
            required: true,
            include: { model: Presence, required: true, attributes: [] }
          }
        });
        const data = [];
        for (const activeEmployee of activeEmployees) {
          data.push({
            company_name: activeEmployee.company_name || activeEmployee.name,
            total_employee: allEmployees.find(val => val.id === activeEmployee.id).employees.length,
            total_active_employee: activeEmployee.employees.length
          });
        }
        return data;
      } catch (error) {
        dbError(error);
      }
    },
    subscribingCompany: async (root, { year }) => {
      try {
        const subscriptions = await SubscriptionDetail.findAll({
          where: Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('subscription_details.created_at'), '%Y'),
            year
          ),
          include: [
            {
              model: Company,
              attributes: ['name', 'company_name'],
              include: { model: Subscription }
            }
          ]
        });
        const findSubscriptionType = (data, subscription) => {
          const compose = [...data];
          const date = dateConverter(subscription.created_at);
          let subscriptionFound = false;
          const index = compose.findIndex(val => val.date === date);
          if (
            subscription.company.subscriptions[0].subscribe_type === 'Perusahaan' &&
            subscription.company.subscriptions[0].subscribe_freq === '12'
          ) {
            compose[index].perusahaan_yearly += 1;
            subscriptionFound = true;
          }
          if (
            subscription.company.subscriptions[0].subscribe_type === 'Perusahaan' &&
            subscription.company.subscriptions[0].subscribe_freq === '1'
          ) {
            compose[index].perusahaan_monthly += 1;
            subscriptionFound = true;
          }
          if (
            subscription.company.subscriptions[0].subscribe_type === 'Basic' &&
            subscription.company.subscriptions[0].subscribe_freq === '12'
          ) {
            compose[index].basic_yearly += 1;
            subscriptionFound = true;
          }
          if (
            subscription.company.subscriptions[0].subscribe_type === 'Basic' &&
            subscription.company.subscriptions[0].subscribe_freq === '1'
          ) {
            compose[index].basic_monthly += 1;
            subscriptionFound = true;
          }
          if (subscriptionFound)
            compose[index].company_lists.push({
              name: subscription.company.company_name || subscription.company.name
            });
          compose[index].total =
            compose[index].perusahaan_yearly +
            compose[index].perusahaan_monthly +
            compose[index].basic_yearly +
            compose[index].basic_monthly;
          return compose;
        };
        const dateConverter = date => {
          let result;
          const newDate = new Date(date);
          result = `${dateHelper[newDate.getMonth() + 1]} ${newDate.getFullYear()}`;
          return result;
        };

        let data = [];
        for (const subscription of subscriptions) {
          let index = -1;
          const date = dateConverter(subscription.created_at);
          index = data.findIndex(val => val.date === date);
          if (index === -1) {
            let compose = {
              date,
              basic_monthly: 0,
              basic_yearly: 0,
              perusahaan_monthly: 0,
              perusahaan_yearly: 0,
              total: 0,
              company_lists: []
            };
            data.push(compose);
            data = findSubscriptionType(data, subscription);
          } else {
            data = findSubscriptionType(data, subscription);
          }
        }
        return data;
      } catch (error) {
        dbError(error);
      }
    },
    totalPresenceEmployee: async (root, { year }) => {
      try {
        const employees = await Presence.findAll({
          where: Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('presences.presence_date'), '%Y'),
            year
          ),
          attributes: ['employee_id', 'presence_date']
        });

        const dateConverter = date => {
          let result;
          const newDate = new Date(date);
          result = `${dateHelper[newDate.getMonth() + 1]} ${newDate.getFullYear()}`;
          return result;
        };

        let data = [];

        for (const employee of employees) {
          const date = dateConverter(employee.presence_date);
          const index = data.findIndex(val => val.date === date);

          if (index === -1) {
            data.push({
              date,
              total: 1,
              idEmployee: [employee.dataValues.employee_id]
            });
          } else {
            const idUnique = data[index].idEmployee.findIndex(
              val => val === employee.dataValues.employee_id
            );

            if (idUnique === -1) {
              data[index].total += 1;
              data[index].idEmployee.push(employee.dataValues.employee_id);
            }
          }
        }

        return data;
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

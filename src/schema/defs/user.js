const { gql } = require('apollo-server-express');
const crypt = require('bcrypt');
const { Sequelize, users: User, bank_data: BankData, employees: Employee } = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');
const { Op } = Sequelize;
/**
 * User Graphql Defs
 */

// TypeDef of User
const typeDef = gql`
  extend type Query {
    user(id: Int!): User!
    users(limit: Int, offset: Int): [User]!
    search_users(search: String!): [User]!
  }

  extend type Mutation {
    updateUser(
      id: Int!
      full_name: String
      email: String
      password: String
      birthday: String
      phone: String
      is_active_notif: Boolean
      is_phone_confirmed: Boolean
      currency: String
      registration_complete: Boolean
    ): User!
    createUser(
      id: Int!
      full_name: String!
      email: String!
      password: String!
      birthday: String!
      phone: String!
      is_active_notif: Boolean!
      is_phone_confirmed: Boolean!
      currency: String!
      registration_complete: Boolean!
    ): User!
    deleteUser(id: Int!): String!
  }
  type User {
    id: Int
    full_name: String
    email: String
    password: String
    birthday: String
    phone: String
    hash: String
    is_active_notif: Boolean
    is_phone_confirmed: Boolean
    currency: String
    registration_complete: Boolean
    bank_data: BankData
    employee: Employee
    created_at: String
    updated_at: String
    count: Int
  }

  type BankData {
    id: Int
    full_name: String
    bank_name: String
    bank_branch: String
    account_number: String
    active: Boolean
    user_id: Int
    created_at: String
    updated_at: String
  }
`;

// User Resolvers
const resolvers = {
  User: {
    bank_data: async root => {
      const { id } = root;
      try {
        const result = await BankData.findOne({
          where: { user_id: id, active: 1 }
        });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    employee: async root => {
      const { id } = root;
      try {
        const result = await Employee.findOne({
          where: { user_id: id }
        });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    count: async root => {
      try {
        const all = await User.all();
        const totalUsers = all.length;
        return totalUsers;
      } catch (error) {
        dbError(error);
      }
    }
  },
  Query: {
    user: async (root, { id }) => {
      try {
        const result = await User.findOne({ where: { id } });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    users: async (root, params) => {
      const { limit, offset } = params;
      try {
        return await User.all({ offset, limit });
      } catch (error) {
        dbError(error);
      }
    },
    search_users: async (root, params) => {
      const { search } = params;
      try {
        return await User.all({
          where: {
            [Op.or]: [
              {
                full_name: {
                  [Op.like]: '%' + search + '%'
                }
              },
              {
                email: {
                  [Op.like]: '%' + search + '%'
                }
              },
              {
                phone: {
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
    updateUser: async (root, params) => {
      const { id } = params;
      try {
        const updateUser = await User.update(params, { where: { id } });
        if (updateUser > 0) {
          const result = await User.findOne({ where: { id } });
          return result;
        }
        throw new Error(`Error update Admin with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    },
    createUser: async (root, params) => {
      const { password, email } = params;
      const hashedPassword = { password: crypt.hashSync(password, 15) };
      const hash = { hash: crypt.hashSync(new Date().toString() + email, 10) };
      try {
        const newUser = User.create(Object.assign(params, hashedPassword, hash));
        if (newUser) {
          return newUser;
        }
      } catch (error) {
        dbError(error);
      }
    },
    deleteUser: async (root, { id }) => {
      try {
        const deletedUser = await User.destroy({ where: { id } });
        if (deletedUser !== 0) {
          return `User with id ${id} was deleted!`;
        }
        throw new Error(`Error deleting User with id ${id}`);
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

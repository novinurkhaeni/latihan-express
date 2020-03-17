const crypt = require('bcrypt');
const { gql } = require('apollo-server-express');
const { admins: Admin } = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');
/**
 * Admin Graphql Defs
 */

// TypeDef of Admin
const typeDef = gql`
  extend type Query {
    admin(id: Int!): Admin!
    admins: [Admin]!
  }

  extend type Mutation {
    updateAdmin(
      id: Int!
      full_name: String
      email: String
      password: String
      roles: Int
      active: Int
    ): Admin!
    createAdmin(
      full_name: String!
      email: String!
      password: String!
      roles: Int!
      active: Int!
    ): Admin!
    deleteAdmin(id: Int!): String!
  }

  type Admin {
    id: Int
    full_name: String
    email: String
    password: String
    roles: Int
    active: Int
    createdAt: String
    UpdatedAt: String
  }
`;

// Admin Resolvers
const resolvers = {
  Query: {
    admin: async (root, { id }) => {
      try {
        const result = await Admin.findOne({ where: { id } });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    admins: async () => await Admin.all()
  },
  Mutation: {
    updateAdmin: async (root, params) => {
      const { id } = params;
      try {
        const updateAdmin = await Admin.update(params, { where: { id } });
        if (updateAdmin > 0) {
          const result = await Admin.findOne({ where: { id } });
          return result;
        }
        throw new Error(`Error update Admin with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    },
    createAdmin: async (root, params) => {
      let { full_name, email, password, roles, active } = params;
      password = crypt.hashSync(password, 15);
      try {
        const newAdmin = Admin.create({
          full_name,
          email,
          password,
          roles,
          active
        });
        if (newAdmin) {
          return newAdmin;
        }
      } catch (error) {
        dbError(error);
      }
    },
    deleteAdmin: async (root, { id }) => {
      try {
        const deletedAdmin = await Admin.destroy({ where: { id } });
        if (deletedAdmin !== 0) {
          return `Admin with id ${id} was deleted!`;
        }
        throw new Error(`Error deleting Admin with id ${id}`);
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

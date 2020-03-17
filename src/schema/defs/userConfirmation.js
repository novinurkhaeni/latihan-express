const { gql } = require('apollo-server-express');
const {
  users: User,
  bank_data: BankData,
  employees: Employee,
  employee_verifs: EmployeeVerif,
  digital_assets: DigitalAsset
} = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');
/**
 * User Graphql Defs
 */

// TypeDef of User Confirmation
const typeDef = gql`
  extend type Query {
    userConfirmation(id: Int!): UserConfirmation!
  }

  extend type Mutation {
    updateEmployeeVerif(id: Int!, status: Int, updated_at: String): EmployeeVerif!
  }

  type UserConfirmation {
    id: Int!
    full_name: String
    email: String
    birthday: String
    phone: String
    bank_data: BankData
    employee_verif: EmployeeVerif
  }

  type EmployeeVerif {
    id: Int!
    employee_id: Int
    status: Int
    created_at: String
    updated_at: String
    assets: DigitalAsset
  }

  type DigitalAsset {
    id: Int!
    path: String
    filename: String
    url: String
    mime_type: String
    is_verified: Int
    type: String
    uploadable_type: String
    uploadable_id: Int
    created_at: String
    updated_at: String
  }
`;

const resolvers = {
  UserConfirmation: {
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
    employee_verif: async root => {
      const { id } = root;
      try {
        let result = await Employee.findOne({
          where: { user_id: id },
          include: {
            model: EmployeeVerif,
            include: { model: DigitalAsset, as: 'assets' }
          }
        });
        if (!result.employee_verif) {
          return null;
        }
        result = result.employee_verif;
        return result;
      } catch (error) {
        dbError(error);
      }
    }
  },
  Query: {
    userConfirmation: async (root, { id }) => {
      try {
        const result = await User.findOne({
          where: { id }
        });
        return result;
      } catch (error) {
        dbError(error);
      }
    }
  },
  Mutation: {
    updateEmployeeVerif: async (root, params) => {
      const { id } = params;
      try {
        const updateEmployeeVerif = await EmployeeVerif.update(params, { where: { id } });
        if (updateEmployeeVerif > 0) {
          const result = await EmployeeVerif.findOne({ where: { id } });
          return result;
        }
        throw new Error(`Error update Employee Verif with id ${id}`);
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

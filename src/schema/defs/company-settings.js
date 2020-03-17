const { gql } = require('apollo-server-express');
const { company_settings: CompanySettings } = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');
/**
 * CompanySettings Graphql Defs
 */

// TypeDef of Company Settings
const typeDef = gql`
  extend type Query {
    companySettings(company_id: Int!): CompanySettingData!
  }

  extend type Mutation {
    createCompanySettings(
      company_id: Int!
      payroll_date: Int!
      notif_presence_overdue: Int!
      presence_overdue_limit: Int!
      overwork_limit: Int!
      notif_overwork: Int!
      rest_limit: Int!
      notif_work_schedule: Int!
      automated_payroll: Int!
    ): CompanySettingData!
    updateCompanySettings(
      id: Int!
      company_id: Int
      payroll_date: Int
      notif_presence_overdue: Int
      presence_overdue_limit: Int
      overwork_limit: Int
      notif_overwork: Int
      rest_limit: Int
      notif_work_schedule: Int
      automated_payroll: Int
      late_deduction: Int
    ): CompanySettingData!
  }

  type CompanySettingData {
    id: Int
    company_id: Int
    payroll_date: Int
    notif_presence_overdue: Int
    presence_overdue_limit: Int
    overwork_limit: Int
    notif_overwork: Int
    rest_limit: Int
    notif_work_schedule: Int
    automated_payroll: Int
    late_deduction: Int
  }
`;

// CompanySettings Resolvers
const resolvers = {
  Query: {
    companySettings: async (root, { id }) => {
      try {
        const result = await CompanySettings.findOne({ where: { id } });
        return result;
      } catch (error) {
        dbError(error);
      }
    }
  },
  Mutation: {
    createCompanySettings: async (root, params) => {
      try {
        const createCompanySettings = await CompanySettings.create(params);
        if (createCompanySettings) {
          return createCompanySettings;
        }
      } catch (error) {
        dbError(error);
      }
    },
    updateCompanySettings: async (root, params) => {
      const { id } = params;
      try {
        const updateCompanySettings = await CompanySettings.update(params, {
          where: { id }
        });
        if (updateCompanySettings > 0) {
          const result = await CompanySettings.findOne({ where: { id } });
          return result;
        }
        throw new Error(`Error update Company with id ${id}`);
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

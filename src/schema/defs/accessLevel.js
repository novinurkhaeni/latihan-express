require('module-alias/register');
const { gql } = require('apollo-server-express');

const {
  employees: Employees,
  abilities: Abilities,
  abilities_category: AbilitiesCategory
} = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');

/**
 * Access Level Graphql Defs
 */

// TypeDef of Access Level

const typeDef = gql`
  extend type Query {
    accessLevel(id: Int!): Abilities!
  }
  extend type Mutation {
    editAccessLevel(id: Int!, type: Int, ability: String): String!
  }

  type Abilities {
    id: Int
    type: Int
    categoryName: String
    ability: String
    standardAbility: String
    employee(id: Int): Employee
  }
`;

// GajianDulu-Data Resolvers
const resolvers = {
  Query: {
    accessLevel: async (root, { id }) => {
      try {
        const accessLevel = await Employees.findOne({
          where: { id },
          include: [{ model: Abilities }]
        });
        const getCategory = await AbilitiesCategory.findOne({
          where: { company_id: accessLevel.company_id, role: accessLevel.role }
        });

        const getStandardAbility = await AbilitiesCategory.findOne({
          where: { company_id: null, role: accessLevel.role },
          attibutes: ['ability']
        });
        if (!accessLevel) {
          throw new Error(`Tidak ada data`);
        }

        let ability = '';
        let standardAbility = '';
        let categoryName = '';

        if (getStandardAbility) {
          ability = getStandardAbility.ability;
          standardAbility = getStandardAbility.ability;
        }

        if (accessLevel.ability) {
          if (accessLevel.ability.type) {
            ability = accessLevel.ability.ability;
            if (getCategory) {
              standardAbility = getCategory.ability;
              categoryName = getCategory.name;
            }
          }
          if (!accessLevel.ability.type) {
            if (getCategory) {
              ability = getCategory.ability;
              standardAbility = getCategory.ability;
              categoryName = getCategory.name;
            }
          }
        }

        const response = {
          id: accessLevel.ability ? accessLevel.ability.id : 0,
          type: accessLevel.ability ? accessLevel.ability.type : 0,
          categoryName,
          ability,
          standardAbility
        };
        return response;
      } catch (error) {
        dbError(error);
      }
    }
  },
  Mutation: {
    editAccessLevel: async (root, { id, type, ability }) => {
      try {
        const payload = {
          type,
          ability
        };
        const editAccessLevel = await Abilities.update(payload, { where: { id } });
        if (!editAccessLevel) {
          throw new Error(`Access Level Gagal Terupdate`);
        }
        return 'Access Level Berhasil Diupdate !';
      } catch (error) {
        dbError(error);
      }
    }
  },
  Abilities: {
    employee: async (root, { id }) => {
      try {
        const employee = await Employees.findOne({ where: { id } });
        if (!employee) {
          throw new Error(`Tidak ada data`);
        }
        return employee;
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

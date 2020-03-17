require('module-alias/register');
const { gql } = require('apollo-server-express');

const { abilities_category: AbilitiesCategory } = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');

/**
 * Category Access Level Graphql Defs
 */

// TypeDef of Category Access Level

const typeDef = gql`
  extend type Query {
    categoryAccessLevel(company_id: Int!): [CategoryAbilities]!
    standardAccessLevel: [CategoryAbilities]!
  }
  extend type Mutation {
    createCategory(company_id: Int, name: String, role: Int!): String!
    editCategory(id: Int!, name: String, role: Int, ability: String): String!
    deleteCategory(id: Int!): String!
  }

  type CategoryAbilities {
    id: Int
    name: String
    role: Int
    ability: String
    defaultAbilities: String
  }
`;

// Category Access Level Resolvers
const resolvers = {
  Query: {
    categoryAccessLevel: async (root, { company_id: companyId }) => {
      try {
        const categories = await AbilitiesCategory.findAll({ where: { company_id: companyId } });
        const response = [];
        for (let i = 0; i < categories.length; i++) {
          const getStandardAbility = await AbilitiesCategory.findOne({
            where: { company_id: null, role: categories[i].role },
            attibutes: ['ability']
          });
          let standardAbility = '';
          if (getStandardAbility) {
            standardAbility = getStandardAbility.ability;
          }
          const data = {
            id: categories[i].id,
            name: categories[i].name,
            role: categories[i].role,
            ability: categories[i].ability,
            defaultAbilities: standardAbility
          };
          response.push(data);
        }
        if (!categories) {
          throw new Error(`Tidak ada data`);
        }
        return response;
      } catch (error) {
        dbError(error);
      }
    },
    standardAccessLevel: async () => {
      try {
        const standardCategories = await AbilitiesCategory.findAll({
          where: { company_id: null },
          attibutes: ['id', 'role', 'ability']
        });
        if (!standardCategories) {
          throw new Error(`Tidak ada data`);
        }
        return standardCategories;
      } catch (error) {
        dbError(error);
      }
    }
  },
  Mutation: {
    createCategory: async (root, params) => {
      const { company_id: companyId, name, role } = params;
      const payload = {
        company_id: companyId,
        name,
        role
      };
      const createCategory = await AbilitiesCategory.create(payload);
      if (!createCategory) {
        throw new Error(`Kategori gagal dibuat`);
      }
      return 'Kategori berhasil dibuat';
    },
    editCategory: async (root, params) => {
      try {
        const findAbility = await AbilitiesCategory.findOne({ where: { id: params.id } });
        if (!findAbility) {
          throw new Error(`Tidak ada data`);
        }
        await AbilitiesCategory.update(params, { where: { id: params.id } });
        return 'Sukses mengubah kategori';
      } catch (error) {
        dbError(error);
      }
    },
    deleteCategory: async (root, params) => {
      try {
        const { id } = params;
        const isCategoryExist = await AbilitiesCategory.findOne({ where: { id } });
        if (!isCategoryExist) {
          throw new Error(`Tidak ada data`);
        }
        await AbilitiesCategory.destroy({ where: { id } });
        return 'Kategori berhasil diubah';
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

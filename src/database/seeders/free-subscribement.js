'use strict';
require('module-alias/register');
const {
  companies: Company,
  parent_companies: ParentCompany,
  packages: Package,
  employees: Employee
} = require('@models');
const { dateConverter } = require('@helpers');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const today = new Date(new Date().setDate(new Date().getDate() - 1));
    const nextMonth = new Date(new Date().setMonth(today.getMonth() + 1));
    const parentCompanies = await ParentCompany.findAll({
      include: {
        model: Company,
        attributes: ['id'],
        include: { model: Employee, where: { role: 1 } }
      }
    });

    const packages = await Package.findAll();
    const transactionPayloads = [];
    const subscribementPayloads = [];

    for (const [index, value] of parentCompanies.entries()) {
      if (value.companies.length) {
        const transactionPayload = {
          id: ('000000' + index).substr(-6),
          employee_id: value.companies[0].employees[0].id,
          parent_company_id: value.id,
          total_amount: 0,
          id_description: 'Gratis langganan Atenda Sakti 1 bulan',
          en_description: 'Free Atenda Subscribement for 1 month',
          payment_status: '00',
          type: 2,
          payment_method: 'mt',
          created_at: today,
          updated_at: today
        };
        transactionPayloads.push(transactionPayload);
        for (const company of value.companies) {
          for (const packaging of packages) {
            const subscribementPayload = {
              company_id: company.id,
              package_id: packaging.id,
              transaction_id: transactionPayload.id,
              date_to_active: dateConverter(today),
              date_to_deactive: dateConverter(nextMonth),
              created_at: today,
              updated_at: today
            };
            subscribementPayloads.push(subscribementPayload);
          }
        }
      }
    }
    await queryInterface.bulkInsert('transactions', transactionPayloads);
    await queryInterface.bulkInsert('subscribements', subscribementPayloads);
    return;
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('transactions', null, {});
  }
};

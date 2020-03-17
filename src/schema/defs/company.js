const Sequelize = require('sequelize');
const { gql } = require('apollo-server-express');
const { Op } = Sequelize;
const {
  companies: Company,
  company_settings: CompanySettingData,
  employees: Employee,
  users: User,
  journals: Journals,
  journal_details: JournalDetail,
  presences: Presence,
  feedbacks: Feedback,
  feedback_conversations: FeedbackConversations,
  subscriptions: Subscription
} = require('@models');
const {
  errorHandler: { dbError },
  dateProcessor
} = require('@helpers');

/**
 * Company Graphql Defs
 */

const makeCodename = async name => {
  let finalCode;
  let codeName = name
    .match(/(?![EIOU])[B-Z]/gi)
    .toString()
    .replace(/,/g, '')
    .substring(0, 6)
    .toUpperCase();
  if (codeName.length < 6) {
    const long = 6 - codeName.length;
    codeName = codeName + 'X'.repeat(long);
  }
  const companyExist = await Company.findOne({
    order: [['created_at', 'DESC']],
    where: { codename: { [Op.like]: `${codeName}%` } }
  });

  if (companyExist) {
    let lastNums = companyExist.codename.substr(-3);
    lastNums = parseInt(lastNums);
    lastNums++;
    lastNums = ('0000' + lastNums).substr(-3);
    finalCode = codeName + '-' + lastNums;
  } else {
    const lastNum = '001';
    finalCode = codeName + '-' + lastNum;
  }
  return finalCode;
};

// TypeDef of Company
const typeDef = gql`
  extend type Query {
    company(id: Int!): Company!
    companies(offset: Int, limit: Int): [Company]!
    companiesNotApproved: [Company]!
    companiesOverdue(month: String, year: String): [Company]!
    currentCompanyRegistrant(month: String, year: String): [Company]!
    search_companies_table(search: String!): [Company]!
  }

  extend type Mutation {
    updateCompany(
      id: Int!
      codename: String
      company_name: String
      name: String
      unique_id: String
      address: String
      phone: String
      active: Int
      timezone: String
      location: String
    ): Company!
    updateStatusTeam(id: Int!, active: String!): Company!
    createCompany(
      name: String!
      unique_id: String!
      address: String!
      phone: String!
      timezone: String!
      location: String!
    ): Company!
    deleteCompany(id: Int!): String!
    emailReminder(name: String!, id: Int!, codename: String!, address: String!): String
  }

  type Company {
    id: Int
    codename: String
    company_name: String
    name: String
    unique_id: String
    address: String
    phone: String
    timezone: String
    location: String
    active: String
    created_at: String
    updated_at: String
    settings: CompanySettingData
    totalWithdraw(startDate: String, endDate: String, month: String, year: String): Int
    restSalary(startDate: String, endDate: String, month: String, year: String): Int
    user: User
    employeesCompany: [Employee]
    subscriptions: [Subscription]
    count: Int
  }
`;

// Company Resolvers
const resolvers = {
  Query: {
    company: async (root, { id }) => {
      try {
        let result = await Company.findOne({
          where: { id },
          include: {
            model: Subscription
          }
        });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    companies: async (root, params) => {
      const { limit, offset } = params;
      try {
        const result = await Company.findAll({
          offset,
          limit,
          include: {
            model: Subscription
          }
        });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    companiesNotApproved: async () => {
      try {
        const result = await Company.findAll({
          where: {
            active: 0,
            [Op.and]: {
              where: Sequelize.where(
                Sequelize.fn('datediff', Sequelize.fn('NOW'), Sequelize.col('created_at')),
                { [Op.gte]: 7 }
              )
            }
          }
        });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    companiesOverdue: async (root, params) => {
      try {
        const result = await Company.findAll({
          where: {
            active: -1,
            $and: [
              Sequelize.where(
                Sequelize.fn('YEAR', Sequelize.col('companies.updated_at')),
                params.year
              ),
              Sequelize.where(
                Sequelize.fn('MONTH', Sequelize.col('companies.updated_at')),
                params.month
              )
            ]
          }
        });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    currentCompanyRegistrant: async (root, params) => {
      try {
        const result = await Company.findAll({
          where: {
            $and: [
              Sequelize.where(
                Sequelize.fn('YEAR', Sequelize.col('companies.created_at')),
                params.year
              ),
              Sequelize.where(
                Sequelize.fn('MONTH', Sequelize.col('companies.created_at')),
                params.month
              )
            ]
          },
          include: {
            model: Subscription
          }
        });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    search_companies_table: async (root, params) => {
      const { search } = params;
      try {
        return await Company.all({
          where: {
            [Op.or]: [
              {
                codename: {
                  [Op.like]: '%' + search + '%'
                }
              },
              {
                company_name: {
                  [Op.like]: '%' + search + '%'
                }
              },
              {
                name: {
                  [Op.like]: '%' + search + '%'
                }
              },
              {
                address: {
                  [Op.like]: '%' + search + '%'
                }
              },
              {
                phone: {
                  [Op.like]: '%' + search + '%'
                }
              }
            ]
          },
          include: {
            model: Subscription
          }
        });
      } catch (error) {
        dbError(error);
      }
    }
  },
  Company: {
    settings: async (root, params) => {
      try {
        const result = await CompanySettingData.findOne({
          where: { company_id: root.id }
        });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    employeesCompany: async (root, params) => {
      try {
        const EmployeeList = await Employee.findAll({
          where: { company_id: root.id }
        });

        return EmployeeList;
      } catch (error) {
        dbError(error);
      }
    },
    user: async (root, params) => {
      try {
        const result = await User.all({ where: { id: root.user_id } });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    totalWithdraw: async (root, params) => {
      try {
        let withdrawData = [];
        let depositTotal = 0;
        let employeeIdArray = [];
        let start;
        let end;

        const EmployeeList = await Employee.findAll({
          where: { company_id: root.id },
          include: {
            model: Company,
            include: {
              model: CompanySettingData,
              as: 'setting',
              attributes: ['payroll_date']
            }
          }
        });
        if (!params.startDate && !params.endDate) {
          let payrollDate = 0;
          if (EmployeeList.length) {
            if (EmployeeList[0].company.setting) {
              payrollDate = EmployeeList[0].company.setting.payroll_date;
            }
          }
          start = dateProcessor.getRangedDate(payrollDate).dateStart;
          end = dateProcessor.getRangedDate(payrollDate).dateEnd;
        } else {
          start = new Date(params.startDate);
          end = new Date(params.endDate);
          start = new Date(`${start} -0700`);
          end = new Date(`${end} -0700`);
          start = `${start.getFullYear()}-${('0' + (start.getMonth() + 1)).slice(-2)}-${(
            '0' + start.getDate()
          ).slice(-2)}`;
          end = `${end.getFullYear()}-${('0' + (end.getMonth() + 1)).slice(-2)}-${(
            '0' + end.getDate()
          ).slice(-2)}`;
        }

        EmployeeList.forEach(data => {
          employeeIdArray.push(data.id);
        });

        withdrawData = await JournalDetail.findAll({
          where: { status: 1 },
          include: {
            model: Journals,
            attributes: ['type', 'employee_id', 'description'],
            where: [
              { employee_id: employeeIdArray, type: 'withdraw' },
              Sequelize.where(
                Sequelize.fn(
                  'DATE_FORMAT',
                  Sequelize.col('journal_details.created_at'),
                  '%Y-%m-%d'
                ),
                '>=',
                `${start}`
              ),
              Sequelize.where(
                Sequelize.fn(
                  'DATE_FORMAT',
                  Sequelize.col('journal_details.created_at'),
                  '%Y-%m-%d'
                ),
                '<=',
                `${end}`
              )
            ]
          }
        });
        if (withdrawData.length) {
          for (let i = 0; i < withdrawData.length; i++) {
            depositTotal += withdrawData[i].total;
          }
        }
        return depositTotal;
      } catch (error) {
        dbError(error);
      }
    },
    restSalary: async (root, params) => {
      let journalData = null;
      let withdrawData = null;
      let employeeIdArray = [];
      let depositTotal = 0;
      let start;
      let end;

      const EmployeeList = await Employee.findAll({
        where: { company_id: root.id },
        include: {
          model: Company,
          include: { model: CompanySettingData, as: 'setting', attributes: ['payroll_date'] }
        }
      });
      if (!params.startDate && !params.endDate) {
        let payrollDate = 0;
        if (EmployeeList.length) {
          if (EmployeeList[0].company.setting) {
            payrollDate = EmployeeList[0].company.setting.payroll_date;
          }
        }
        start = dateProcessor.getRangedDate(payrollDate).dateStart;
        end = dateProcessor.getRangedDate(payrollDate).dateEnd;
      } else {
        start = new Date(params.startDate);
        end = new Date(params.endDate);
        start = new Date(`${start} -0700`);
        end = new Date(`${end} -0700`);
        start = `${start.getFullYear()}-${('0' + (start.getMonth() + 1)).slice(-2)}-${(
          '0' + start.getDate()
        ).slice(-2)}`;
        end = `${end.getFullYear()}-${('0' + (end.getMonth() + 1)).slice(-2)}-${(
          '0' + end.getDate()
        ).slice(-2)}`;
      }

      EmployeeList.forEach(data => {
        employeeIdArray.push(data.id);
      });

      journalData = await Journals.findOne({
        where: [
          { employee_id: employeeIdArray },
          { type: { [Op.notIn]: ['withdraw', 'subscribe', 'payment'] } },
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
            '>=',
            `${start}`
          ),
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
            '<=',
            `${end}`
          )
        ],
        attributes: [[Sequelize.fn('SUM', Sequelize.literal('`debet`-`kredit`')), 'total_salary']]
      });

      withdrawData = await JournalDetail.findAll({
        where: { status: 1 },
        include: {
          model: Journals,
          attributes: ['type', 'employee_id', 'description'],
          where: [
            { employee_id: employeeIdArray, type: 'withdraw' },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('journal_details.created_at'), '%Y-%m-%d'),
              '>=',
              `${start}`
            ),
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('journal_details.created_at'), '%Y-%m-%d'),
              '<=',
              `${end}`
            )
          ]
        }
      });
      if (withdrawData.length) {
        for (let i = 0; i < withdrawData.length; i++) {
          depositTotal += withdrawData[i].total;
        }
      }
      return (journalData && journalData.dataValues.total_salary - depositTotal) || 0;
    },
    count: async (root, params) => {
      try {
        const all = await Company.all();
        const totalCompany = all.length;
        return totalCompany;
      } catch (error) {
        dbError(error);
      }
    }
  },
  Mutation: {
    updateCompany: async (root, params) => {
      const data = params;
      const { id: company_id } = params;
      try {
        let updateCompany = await Company.findOne({ where: { id: company_id } });
        if (!updateCompany) {
          throw new Error(`Company with id ${company_id} is not found`);
        }

        let finalCode;
        const existingName = data.company_name ? data.company_name : data.name;
        let codeName = existingName
          .match(/(?![EIOU])[B-Z]/gi)
          .toString()
          .replace(/,/g, '')
          .substring(0, 6)
          .toUpperCase();
        if (codeName.length < 6) {
          const long = 6 - codeName.length;
          codeName = codeName + 'X'.repeat(long);
        }
        const isCodenameSame = await Company.findOne({
          where: { codename: { [Op.like]: `${codeName}%` }, id: company_id }
        });

        if (!isCodenameSame) {
          const companyExist = await Company.findOne({
            order: [['created_at', 'DESC']],
            where: { codename: { [Op.like]: `${codeName}%` } }
          });

          if (companyExist) {
            let lastNums = companyExist.codename.substr(-3);
            lastNums = parseInt(lastNums);
            lastNums++;
            lastNums = ('0000' + lastNums).substr(-3);
            finalCode = codeName + '-' + lastNums;
          } else {
            const lastNum = '001';
            finalCode = codeName + '-' + lastNum;
          }
          Object.assign(data, {
            codename: finalCode
          });
        }
        Object.assign(data, {
          company_name: data.company_name ? data.company_name : null
        });

        updateCompany = await Company.update(data, {
          where: { id: company_id }
        });
        if (!updateCompany) {
          throw new Error(`Nothing changed in Company with id ${company_id}`);
        }
        updateCompany = await Company.findOne({ where: { id: company_id } });
        return updateCompany;
      } catch (error) {
        dbError(error);
      }
    },
    updateStatusTeam: async (root, params) => {
      const { id } = params;
      try {
        const updateStatusTeam = await Company.update(params, {
          where: { id }
        });
        if (updateStatusTeam > 0) {
          const result = await Company.findOne({ where: { id } });
          return result;
        }
        throw new Error(`Error update status team with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    },
    createCompany: async (root, params) => {
      const { unique_id, name } = params;
      try {
        const isUnique = await Company.findOne({ where: { unique_id } });
        const codename = { codename: await makeCodename(name), active: true };
        if (!isUnique) {
          const newCompany = Company.create(Object.assign(params, codename));
          if (newCompany) {
            return newCompany;
          }
        }
        throw new Error('Gagal: perusahaan yang dipilih sudah terdaftar dalam GajianDulu');
      } catch (error) {
        dbError(error);
      }
    },
    deleteCompany: async (root, { id }) => {
      try {
        const EmployeeList = await Employee.findAll({
          where: { company_id: id }
        });

        for (let i = 0; i < EmployeeList.length; i++) {
          await User.destroy({
            where: { id: EmployeeList[i].user_id }
          });
          await Presence.destroy({
            where: { employee_id: EmployeeList[i].id }
          });

          // Delete Journal and Journal Detail
          const journalList = await Journals.findAll({
            where: { employee_id: EmployeeList[i].id }
          });

          for (let j = 0; j < journalList.length; j++) {
            await JournalDetail.destroy({
              where: { journal_id: journalList[j].id }
            });
          }
          await Journals.destroy({
            where: { employee_id: EmployeeList[i].id }
          });

          // Delete Feedback and Feedback Conversations
          const FeedbackList = await Feedback.findAll({
            where: { employee_id: EmployeeList[i].id }
          });
          for (let k = 0; k < FeedbackList.length; k++) {
            await FeedbackConversations.destroy({
              where: { feedback_id: FeedbackList[k].id }
            });
          }
          await Feedback.destroy({
            where: { employee_id: EmployeeList[i].id }
          });
        }
        await CompanySettingData.destroy({
          where: { company_id: id }
        });
        await Employee.destroy({
          where: { company_id: id }
        });
        await Company.destroy({ where: { id } });
      } catch (error) {
        dbError(error);
      }
    },
    updateCompanySettings: async (root, params) => {
      const { id } = params;
      try {
        const updateCompanySettings = await Company.update(params, {
          where: { id }
        });
        if (updateCompanySettings > 0) {
          const result = await Company.findOne({ where: { id } });
          return result;
        }
        throw new Error(`Error update status team with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    },
    emailReminder: async (root, params) => {
      // Useless Graphql
      return 'Useless Graphql';
    }
  }
};

module.exports = {
  typeDef,
  resolvers
};

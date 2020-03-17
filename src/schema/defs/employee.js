const { gql } = require('apollo-server-express');
const Sequelize = require('sequelize');
const {
  employees: Employee,
  users: User,
  companies: Company,
  bankData: BankData,
  journals: Journal,
  journal_details: JournalDetail,
  presences: Presence
} = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');
/**
 * Employee Graphql Defs
 */

// TypeDef of Employee
const typeDef = gql`
  extend type Query {
    employee(id: Int!): Employee!
    employees: [Employee]!
    unregisteredMember: [Employee]!
  }

  extend type Mutation {
    updateEmployee(
      id: Int!
      company_id: Int
      user_id: Int
      role: Int
      salary: Int
      workdays: Int
      daily_salary: Int
      flag: Int
      active: Int
      created_at: String
      updated_at: String
    ): Employee!
    createEmployee(
      company_id: Int!
      user_id: Int!
      role: Int!
      salary: Int!
      workdays: Int!
      daily_salary: Int!
      flag: Int!
      active: Int!
    ): Employee!
    updateGajianduluStatus(id: Int!): String!
    bulkEnableGajianduluStatus(company_id: Int!): String!
    bulkDisableGajianduluStatus(company_id: Int!): String!
    updateEmployeeSalary(
      employee_id: Int!
      salary: Int!
      workdays: Int!
      daily_salary: Int!
    ): String!
    deleteEmployee(id: Int!): String!
  }

  type Employee {
    id: Int
    company_id: Int
    user_id: Int
    role: Int
    salary: Int
    workdays: Int
    daily_salary: Int
    flag: Int
    active: Int
    created_at: String
    updated_at: String
    user: User
    company: Company
    bankData: BankData
    gajiandulu_status: Int
    journals(month: String, year: String): [Journal]
    totalWithdrawEmployee(month: String, year: String, startDate: String, endDate: String): Int
    restSalaryEmployee(month: String, year: String, startDate: String, endDate: String): Int
    presenceList(month: String, year: String): [Presence]
    totalPresenceOverdue(month: String, year: String): Int
    totalOverwork(month: String, year: String): Int
  }
`;

// Employee Resolvers
const resolvers = {
  Query: {
    employee: async (root, { id }) => {
      try {
        const result = await Employee.findOne({ where: { id } });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    employees: async () => await Employee.all(),
    unregisteredMember: async (root, params) => {
      try {
        const result = await Employee.findAll({ where: { active: 0 } });
        return result;
      } catch (error) {
        dbError(error);
      }
    }
  },
  Employee: {
    user: async (root, params) => {
      try {
        const result = await User.findOne({ where: { id: root.user_id } });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    company: async (root, params) => {
      try {
        const result = await Company.findOne({
          where: { id: root.company_id }
        });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    bankData: async (root, params) => {
      try {
        const result = await BankData.findOne({
          where: { user_id: root.user_id }
        });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    presenceList: async (root, params) => {
      try {
        const { id } = root;
        const { month, year } = params;
        const presenceList = await Presence.findAll({
          where: [
            { employee_id: id },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('presence_date'), '%Y-%c'),
              `${year}-${month}`
            )
          ],
          order: [['presence_date', 'DESC']]
        });
        return presenceList;
      } catch (error) {
        dbError(error);
      }
    },
    journals: async (root, params) => {
      try {
        const result = await Journal.findAll({
          where: {
            employee_id: root.id,
            $and: [
              Sequelize.where(Sequelize.fn('YEAR', Sequelize.col('created_at')), params.year),
              Sequelize.where(Sequelize.fn('MONTH', Sequelize.col('created_at')), params.month)
            ]
          }
        });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    totalWithdrawEmployee: async (root, params) => {
      try {
        const start = new Date(params.startDate);
        const end = new Date(params.endDate);
        start.setTime(start.getTime() + 1000 * 60 * 60 * 7);
        end.setTime(end.getTime() + 1000 * 60 * 60 * 7);
        let totalWithdrawEmployee = 0;
        const withdrawData = await JournalDetail.findAll({
          where: {
            status: 1,
            created_at: {
              $between: [start, end]
            }
          },
          include: {
            model: Journal,
            attributes: ['type', 'employee_id', 'description'],
            where: [{ employee_id: root.id, type: 'withdraw' }]
          }
        });

        if (withdrawData.length) {
          withdrawData.map(data => {
            totalWithdrawEmployee += data.total;
          });
        }

        return totalWithdrawEmployee;
      } catch (error) {
        dbError(error);
      }
    },
    restSalaryEmployee: async (root, params) => {
      let debet = 0;
      let kredit = 0;
      let totalDebet = 0;
      let totalKredit = 0;
      let totalWithdraw = 0;
      let arrayDebetKredit = [];

      const start = new Date(params.startDate);
      const end = new Date(params.endDate);
      start.setTime(start.getTime() + 1000 * 60 * 60 * 7);
      end.setTime(end.getTime() + 1000 * 60 * 60 * 7);

      const totalRestSalary = await Journal.findAll({
        where: {
          employee_id: root.id,
          created_at: {
            $between: [start, end]
          }
        }
      });

      const withdrawData = await JournalDetail.findAll({
        where: {
          status: 1,
          created_at: {
            $between: [start, end]
          }
        },
        include: {
          model: Journal,
          attributes: ['type', 'employee_id', 'description'],
          where: [{ employee_id: root.id, type: 'withdraw' }]
        }
      });

      if (withdrawData.length) {
        withdrawData.map(data => {
          totalWithdraw += data.total;
        });
      }

      totalRestSalary.map(data => {
        kredit += data.kredit;
        debet += data.debet;
      });
      arrayDebetKredit.push({ kredit, debet });

      arrayDebetKredit.map(data => {
        totalKredit += data.kredit;
        totalDebet = +data.debet;
      });

      return totalDebet - totalKredit - totalWithdraw;
    },
    totalPresenceOverdue: async (root, params) => {
      const { id } = root;
      const { month, year } = params;
      try {
        let presenceOverdue = 0;
        await Presence.sum('presence_overdue', {
          where: {
            employee_id: id,
            $and: [
              Sequelize.where(Sequelize.fn('YEAR', Sequelize.col('presence_date')), year),
              Sequelize.where(Sequelize.fn('MONTH', Sequelize.col('presence_date')), month)
            ]
          }
        }).then(sum => {
          presenceOverdue = sum;
        });
        return presenceOverdue;
      } catch (error) {
        dbError(error);
      }
    },
    totalOverwork: async (root, params) => {
      const { id } = root;
      const { month, year } = params;
      try {
        let overwork = 0;
        await Presence.sum('overwork', {
          where: {
            employee_id: id,
            $and: [
              Sequelize.where(Sequelize.fn('YEAR', Sequelize.col('presence_date')), year),
              Sequelize.where(Sequelize.fn('MONTH', Sequelize.col('presence_date')), month)
            ]
          }
        }).then(sum => {
          overwork = sum;
        });
        return overwork;
      } catch (error) {
        dbError(error);
      }
    }
  },
  Mutation: {
    updateEmployee: async (root, params) => {
      const { id } = params;
      try {
        const updateEmployee = await Employee.update(params, { where: { id } });
        if (updateEmployee > 0) {
          const result = await Employee.findOne({ where: { id } });
          return result;
        }
        throw new Error(`Error update Admin with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    },
    createEmployee: async (root, params) => {
      try {
        const newEmployee = Employee.create(params);
        if (newEmployee) {
          return newEmployee;
        }
      } catch (error) {
        dbError(error);
      }
    },
    deleteEmployee: async (root, { id }) => {
      try {
        const deletedEmployee = await Employee.destroy({ where: { id } });
        if (deletedEmployee !== 0) {
          return `Employee with id ${id} was deleted!`;
        }
        throw new Error(`Error deleting Employee with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    },
    updateEmployeeSalary: async (root, params) => {
      const { employee_id, salary, workdays, daily_salary } = params;
      const thisDate = new Date();
      try {
        const withdrawData = await Journal.findOne({
          where: [
            { type: 'withdraw', employee_id },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('journals.created_at'), '%Y-%m'),
              `${thisDate.getFullYear()}-${('0' + (thisDate.getMonth() + 1)).slice(-2)}`
            )
          ],
          include: {
            model: JournalDetail,
            where: { status: 0 }
          }
        });
        if (withdrawData) {
          throw new Error(
            `Tidak dapat mengubah gaji bulanan karena anggota telah melakukan withdraw bulan ini.`
          );
        }

        const data = {
          salary,
          workdays,
          daily_salary
        };
        const updateEmployeeSalary = await Employee.update(data, { where: { id: employee_id } });
        if (updateEmployeeSalary > 0) {
          return 'Successfuly update salary information';
        }
        throw new Error(`Error update salary information`);
      } catch (error) {
        dbError(error);
      }
    },
    //enable gajiandulu_status
    updateGajianduluStatus: async (root, params) => {
      const { id } = params;
      //console.log('IDnya: ', id);
      try {
        //find gajian status value
        let inputStatus;
        const query = await Employee.findOne({ where: { id } });
        //console.log('status gajian dulu :', query.gajiandulu_status);
        //condition
        query.gajiandulu_status === 1 ? (inputStatus = 0) : (inputStatus = 1);
        //console.log('data baru: ', inputStatus);
        //update to database
        let payload = {
          gajiandulu_status: inputStatus
        };
        const updateGajianduluStatus = await Employee.update(payload, {
          where: { id }
        });
        if (updateGajianduluStatus > 0) {
          //const result = await Employee.findOne({ where: { id } });
          //return result;
          return `Gajiandulu Status with id ${id} was updated`;
        }
        throw new Error(`Error update Admin with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    },
    bulkEnableGajianduluStatus: async (root, params) => {
      const { company_id } = params;
      try {
        const query = await Employee.update({ gajiandulu_status: 1 }, { where: { company_id } });
        if (query > 0) {
          return `Gajiandulu Status with company ID ${company_id} was updated`;
        }
        throw new Error(`Error update Gajiandulu status with Company ID ${company_id}`);
      } catch (error) {
        dbError(error);
      }
    },
    bulkDisableGajianduluStatus: async (root, params) => {
      const { company_id } = params;
      try {
        const query = await Employee.update({ gajiandulu_status: 0 }, { where: { company_id } });
        if (query > 0) {
          return `Gajiandulu Status with company ID ${company_id} was updated`;
        }
        throw new Error(`Error update Gajiandulu status with Company ID ${company_id}`);
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

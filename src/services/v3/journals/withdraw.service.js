require('module-alias/register');
const {
  response,
  dateProcessor: { getRangedDate }
} = require('@helpers');
const {
  Sequelize,
  users: User,
  digital_assets: DigitalAsset,
  journals: Journal,
  companies: Company,
  company_settings: CompanySetting,
  journal_details: JournalDetail,
  employees: Employee
} = require('@models');

const withdrawService = {
  companiesWithdraw: async (req, res) => {
    const { users } = res.local;
    try {
      const companies = await getAllCompanies(users.companyParentId);
      if (companies.length < 1 || !companies) {
        return res.status(400).json(response(false, 'companies tidak di temukan'));
      }

      const companyIdArrays = companies.map(company => company.id);

      const balanceDate = await Journal.findOne({
        attributes: [[Sequelize.fn('max', Sequelize.col('journals.created_at')), 'created_at']],
        where: { balance: 1, type: 'payment', company_id: companyIdArrays }
      });

      const payload = [];
      let totalCompanyWithdraw = 0;
      for (let i = 0; i < companies.length; i++) {
        const payrollDate = companies[i].setting.payroll_date;
        const employees = companies[i].employees;
        const employeePayload = [];
        let dateStart, dateEnd;
        if (balanceDate.created_at) {
          let today = new Date();
          today = new Date(`${today} -0700`);
          dateStart = balanceDate.created_at;
          dateEnd = await getTodayDetail(today);
        } else {
          const rangedDate = await getRangedDate(payrollDate);
          dateStart = `${rangedDate.dateStart} 00:00:00`;
          dateEnd = `${rangedDate.dateEnd} 00:00:00`;
        }
        let totalBranchWithdraw = 0;

        const companyPayload = {
          id: companies[i].id,
          parent_company_id: companies[i].parent_company_id,
          company_name: companies[i].company_name,
          name: companies[i].name,
          address: companies[i].address,
          location: companies[i].location,
          payroll_date: {
            date_start: dateStart,
            date_end: dateEnd
          }
        };

        for (let x = 0; x < employees.length; x++) {
          const url = employees[x].assets.length > 0 ? employees[x].assets[0].url : null;
          const employeeWithdraws = await getAllWithdraw(employees[x].id, dateStart, dateEnd);
          let totalEmployeeWithdraw = 0;

          for (let y = 0; y < employeeWithdraws.length; y++) {
            totalEmployeeWithdraw += employeeWithdraws[y].journal_detail.total;
            const employee = {
              id: employees[x].id,
              company_id: employees[x].company_id,
              role: employees[x].role,
              full_name: employees[x].user.full_name,
              url,
              date_withdraw: employeeWithdraws[y].created_at,
              total: employeeWithdraws[y].journal_detail.total,
              total_nett: employeeWithdraws[y].journal_detail.total_nett,
              status: employeeWithdraws[y].journal_detail.status
            };
            employeePayload.push(employee);
          }

          totalBranchWithdraw += totalEmployeeWithdraw;
        }

        companyPayload['total_branch_withdraw'] = totalBranchWithdraw;
        companyPayload['employees'] = employeePayload;
        totalCompanyWithdraw += totalBranchWithdraw;
        payload.push(companyPayload);
      }
      return res.status(200).json(
        response(true, 'data penarikan berhasil di dapatkan', {
          total_company_withdraw: totalCompanyWithdraw,
          companies_list: payload
        })
      );
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = withdrawService;

const getAllCompanies = async companyParentId => {
  const companies = await Company.findAll({
    where: {
      parent_company_id: companyParentId
    },
    attributes: ['id', 'parent_company_id', 'company_name', 'name', 'address', 'location'],
    include: [
      {
        model: Employee,
        attributes: ['id', 'company_id', 'role'],
        include: [
          {
            model: User,
            attributes: ['id', 'full_name']
          },
          {
            model: DigitalAsset,
            as: 'assets',
            required: false,
            attributes: ['url'],
            where: {
              type: 'avatar'
            }
          }
        ]
      },
      {
        model: CompanySetting,
        attributes: ['id', 'payroll_date'],
        as: 'setting'
      }
    ]
  });

  return companies;
};

const getAllWithdraw = async (idEmployee, dateFrom, dateEnd) => {
  const withdraws = await Journal.findAll({
    where: [
      Sequelize.where(
        Sequelize.fn('DATE_FORMAT', Sequelize.col('journals.created_at'), '%Y-%m-%d %H:%i:%s'),
        '>=',
        dateFrom
      ),
      Sequelize.where(
        Sequelize.fn('DATE_FORMAT', Sequelize.col('journals.created_at'), '%Y-%m-%d %H:%i:%s'),
        '<=',
        dateEnd
      ),
      {
        employee_id: idEmployee,
        type: 'withdraw'
      }
    ],
    attributes: ['id', 'employee_id', 'type', 'created_at'],
    include: [
      {
        model: JournalDetail,
        attributes: ['id', 'journal_id', 'total', 'total_nett', 'status'],
        where: {
          status: 1
        }
      }
    ]
  });
  return withdraws;
};

const getTodayDetail = async today => {
  const year = today.getFullYear();
  const month =
    (today.getMonth() + 1).toString().length === 2
      ? `${today.getMonth() + 1}`
      : `0${today.getMonth() + 1}`;
  const date =
    today.getDate().toString().length === 2 ? `${today.getDate()}` : `0${today.getDate()}`;
  const hours =
    today.getHours().toString().length === 2 ? `${today.getHours()}` : `0${today.getHours()}`;
  const minutes =
    today.getMinutes().toString().length === 2 ? `${today.getMinutes()}` : `0${today.getMinutes()}`;
  const seconds =
    today.getSeconds().toString().length === 2 ? `${today.getSeconds()}` : `0${today.getSeconds()}`;

  return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
};

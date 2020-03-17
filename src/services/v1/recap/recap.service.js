require('module-alias/register');
const { response } = require('@helpers');
const { employees: Employee, companies: Company, presences: Presence } = require('@models');
const Sequelize = require('sequelize');

const recap = {
  get: async (req, res) => {
    const { year, totalPresence: total } = req.query;
    try {
      const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const datas = [];
      const employees = await Company.findAll({
        attributes: ['created_at', 'codename', 'name', 'id'],
        include: {
          model: Employee,
          attributes: ['id'],
          required: true
        }
      });
      for (const month of months) {
        const data = await Company.findAll({
          attributes: ['created_at', 'codename', 'name', 'id'],
          include: {
            model: Employee,
            attributes: ['id'],
            required: true,
            include: {
              model: Presence,
              attributes: ['id'],
              required: true,
              where: [
                {},
                Sequelize.where(
                  Sequelize.fn('DATE_FORMAT', Sequelize.col('presence_date'), '%Y-%c'),
                  '>=',
                  `${year}-${month}`
                ),
                Sequelize.where(
                  Sequelize.fn('DATE_FORMAT', Sequelize.col('presence_date'), '%Y-%c'),
                  '<=',
                  `${year}-${month}`
                )
              ]
            }
          }
        });
        let eligibleCompany = 0;
        let companyGroup = [];
        for (const company of data) {
          let totalPresence = 0;
          for (const employee of company.employees) {
            totalPresence += employee.presences.length;
          }
          if (totalPresence >= total) {
            companyGroup.push({
              name: company.name,
              codename: company.codename,
              employees: company.employees.length,
              total_employee: employees.find(val => val.id === company.id).employees.length
            });
            eligibleCompany += 1;
          }
        }
        if (data.length) {
          datas.push({ date: `${year}-${month}`, active: eligibleCompany, detail: companyGroup });
        }
      }
      return res.status(200).json(datas);
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = recap;

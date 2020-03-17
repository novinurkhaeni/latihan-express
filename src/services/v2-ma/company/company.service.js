require('module-alias/register');
const { response, dateConverter } = require('@helpers');
const {
  users: User,
  employees: Employee,
  companies: Company,
  digital_assets: DigitalAsset,
  subscribements: Subscribement,
  transactions: Transaction,
  packages: Package
} = require('@models');
const Sequelize = require('sequelize');
const { Op } = Sequelize;

const company = {
  get: async (req, res) => {
    const { parent_company_id } = req.params;
    const { employeeId } = res.local.users;
    const today = dateConverter(new Date());
    try {
      // Get User Data
      const employee = await Employee.findOne({
        attributes: ['id', 'role', 'flag'],
        where: { id: employeeId },
        include: [
          { model: User, attributes: ['id', 'full_name'] },
          {
            model: DigitalAsset,
            required: false,
            attributes: ['url'],
            where: {
              type: 'avatar'
            },
            as: 'assets'
          }
        ]
      });

      // Get Companies Lists
      const companies = await Company.findAll({
        attributes: ['id', 'name', 'company_name', 'phone', 'address', 'codename'],
        where: { parent_company_id },
        order: [['id', 'asc']],
        include: [
          {
            model: DigitalAsset,
            required: false,
            attributes: ['url'],
            where: {
              type: 'avatar'
            },
            as: 'assets'
          },
          {
            model: Subscribement,
            attributes: ['id', 'date_to_deactive'],
            where: { date_to_active: { [Op.lte]: today }, date_to_deactive: { [Op.gte]: today } },
            required: false,
            include: [
              {
                model: Transaction,
                where: { payment_status: '00' },
                attributes: [],
                required: true
              },
              {
                model: Package,
                where: { type: 1 },
                required: true,
                attributes: []
              }
            ]
          }
        ]
      });

      // Findout is Company Ever Payed
      const payedCompany = await Company.findAll({
        attributes: ['id'],
        where: { parent_company_id },
        include: [
          {
            model: Subscribement,
            attributes: ['company_id', 'transaction_id'],
            required: false,
            limit: 1,
            include: [
              {
                model: Transaction,
                where: { payment_status: '00' },
                attributes: [],
                required: true
              }
            ]
          }
        ]
      });
      const payload = {
        user: {
          id: employee.user.id,
          employee_id: employee.id,
          role: employee.role,
          flag: employee.flag,
          full_name: employee.user.full_name,
          avatar: employee.assets.length ? employee.assets[0].url : null
        },
        companies: companies
          .map(val => ({
            id: val.id,
            name: val.company_name || val.name,
            codename: val.codename,
            phone: val.phone,
            address: val.address,
            asset: val.assets ? val.assets.url : null,
            date_to_deactive: val.subscribements.length
              ? val.subscribements[0].date_to_deactive
              : null
          }))
          .filter(
            (val, index) =>
              payedCompany.find(data => data.id == val.id).subscribements.length !== 0 || index == 0
          )
      };
      return res.status(200).json(response(true, 'Berhasil mendapatkan daftar cabang', payload));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getDetail: async (req, res) => {
    const { company_id } = req.params;
    try {
      const company = await Company.findOne({
        group: ['companies.id', 'assets.id'],
        attributes: [
          'id',
          'name',
          'company_name',
          'parent_company_id',
          'codename',
          [Sequelize.fn('COUNT', Sequelize.col('employees.id')), 'total_employees']
        ],
        where: { id: company_id },
        include: [
          {
            model: Employee,
            where: { active: 1, role: { [Op.ne]: 1 } },
            attributes: [],
            required: false
          },
          {
            model: DigitalAsset,
            required: false,
            attributes: ['url'],
            where: {
              type: 'avatar'
            },
            as: 'assets'
          }
        ]
      });

      const payload = {
        id: company.id,
        name: company.company_name || company.name,
        parent_company_id: company.parent_company_id,
        total_employees: company.dataValues.total_employees,
        asset: company.assets ? company.assets.url : null
      };

      return res.status(200).json(response(true, 'Berhasil mendapatkan detail cabang', payload));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = company;

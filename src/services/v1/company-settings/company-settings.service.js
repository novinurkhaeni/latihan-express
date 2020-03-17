require('module-alias/register');
const { response, dateProcessor } = require('@helpers');
const {
  company_settings: CompanySettingModel,
  companies: CompanyModel,
  employees: EmployeeModel,
  digital_assets: DigitalAssetModel,
  users: UserModel,
  abilities: Ability,
  cron_payroll_dates: CronPayrollDates,
  subscriptions: Subscriptions
} = require('@models');

const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const companySettingService = {
  get: async (req, res) => {
    const { company_id } = req.params;
    const { id: userId, companyParentId } = res.local.users;

    try {
      const company = await CompanyModel.findOne({ where: { id: company_id } });
      if (!company) {
        return res.status(400).json(response(false, `Company with id ${company_id} is not found`));
      }

      const userData = await EmployeeModel.findOne({
        where: { company_id, user_id: userId, active: 1 },
        include: [
          {
            model: UserModel
          }
        ]
      });

      const assets = await DigitalAssetModel.findAll({
        where: {
          uploadable_id: userData.id,
          uploadable_type: 'employees',
          type: 'avatar'
        }
      });
      const companySetting = await CompanySettingModel.findOne({
        where: { company_id }
      });

      const companyBranches = await CompanyModel.findAll({
        where: {
          parent_company_id: companyParentId
        },
        attributes: ['id', 'company_name', 'name', 'address', 'phone', 'location', 'codename'],
        include: [
          {
            model: Subscriptions,
            through: {
              where: { active: 1 }
            }
          },
          {
            model: DigitalAssetModel,
            attributes: ['url'],
            required: false,
            where: { type: 'avatar' },
            as: 'assets'
          }
        ],
        order: [['id', 'ASC']]
      });

      const results = {
        id: company.id,
        codename: company.codename,
        company_name: company.company_name,
        name: company.name,
        address: company.address,
        phone: company.phone,
        timezone: company.timezone,
        location: company.location,
        unique_id: company.unique_id,
        active: company.active,
        created_at: company.created_at,
        updated_at: company.updated_at,
        employee: {
          id: userData.id,
          role: userData.role,
          full_name: userData.user.full_name,
          email: userData.user.email,
          phone: userData.user.phone,
          assets
        },
        setting: companySetting,
        company_branch: companyBranches
      };

      return res
        .status(200)
        .json(response(true, 'Setting has been successfully retrieved', results));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  create: async (req, res) => {
    const { data } = req.body;
    const { id: companyId } = req.params;
    const { id: user_id } = res.local.users;

    try {
      let company = await CompanyModel.findOne({
        where: {
          id: companyId
        }
      });
      if (!company) {
        return res.status(400).json(response(false, `Company with id ${companyId} is not found`));
      }
      const payload = Object.assign({}, data, {
        company_id: companyId
      });

      company = await CompanySettingModel.findOne({
        where: { company_id: companyId }
      });
      if (company) {
        return res
          .status(400)
          .json(response(false, `Failed, company settings with id ${companyId} has already exist`));
      }
      company = await CompanySettingModel.create(payload);

      const employee = await EmployeeModel.create({
        company_id: companyId,
        salary: 0,
        user_id,
        role: 1,
        flag: 3
      });
      await UserModel.update({ registration_complete: 1 }, { where: { id: user_id } });

      await CompanyModel.update({ registration_complete: 1 }, { where: { id: companyId } });

      // Create Ability Record
      await Ability.create({ employee_id: employee.id });

      company.dataValues.employee_id = employee.id;

      // SEND NOTIFICATION WELCOME
      observe.emit(EVENT.SEND_WELCOME, {
        userId: user_id,
        employeeId: employee.id
      });

      return res
        .status(200)
        .json(response(true, 'Company settings has been successfully saved', company));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  patch: async (req, res) => {
    const { data } = req.body;
    const { id: companyId } = req.params;

    try {
      let company = await CompanyModel.findOne({
        where: {
          id: companyId
        }
      });
      if (!company) {
        return res.status(400).json(response(false, `Company with id ${companyId} is not found`));
      }

      if (data) {
        let companySetting = await CompanySettingModel.findOne({
          where: {
            company_id: companyId
          }
        });
        if (!companySetting) {
          return res
            .status(400)
            .json(response(false, `Company Setting with company id ${companyId} is not found`));
        }
        if (data && data.payroll_date) {
          const compose = {
            company_id: companyId,
            payroll_date: data.payroll_date
          };
          const payrollDate = await CronPayrollDates.findOne({ where: { company_id: companyId } });
          if (!payrollDate) {
            await CronPayrollDates.create(compose);
          } else {
            await CronPayrollDates.update(compose, { where: { id: payrollDate.id } });
          }
          const rangedDate = dateProcessor.getRangedDate(companySetting.payroll_date);
          const start = new Date(rangedDate.dateStart);
          const end = new Date(rangedDate.dateEnd);
          const info = `Tanggal mulai kerja akan efektif pada tanggal ${end.getDate()} ${
            start.getMonth() === end.getMonth() ? 'bulan ini' : 'bulan depan'
          }`;
          return res.status(200).json(response(true, info, data));
        } else {
          await CompanySettingModel.update(data, {
            where: {
              company_id: companyId
            }
          });
        }
      }

      return res.status(200).json(response(true, 'Pengaturan berhasil diubah', data));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = companySettingService;

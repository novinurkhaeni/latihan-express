require('module-alias/register');
const { response, dateConverter } = require('@helpers');
const {
  Sequelize: { Op }
} = require('sequelize');
const {
  sequelize,
  company_settings: CompanySettingModel,
  companies: CompanyModel,
  employees: EmployeeModel,
  users: UserModel,
  abilities: Ability,
  cron_payroll_dates: CronPayrollDate,
  digital_assets: DigitalAssetModel,
  subscribements: Subscribement,
  transactions: Transaction,
  packages: Package,
  package_details: PackageDetail
} = require('@models');

const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

class companySettingService {
  constructor(req, res) {
    this.req = req;
    this.res = res;
  }

  async create() {
    const { data } = this.req.body;
    const { id: companyId } = this.req.params;
    const { id: user_id } = this.res.local.users;

    try {
      let company = await CompanyModel.findOne({
        where: {
          id: companyId
        }
      });
      if (!company) {
        return this.res
          .status(400)
          .json(response(false, `Company with id ${companyId} is not found`));
      }
      const settingPayload = Object.assign({
        company_id: companyId,
        presence_overdue_limit: data.presence_overdue_limit,
        overwork_limit: data.overwork_limit,
        rest_limit: data.rest_limit,
        late_deduction: data.late_deduction,
        home_early_deduction: data.home_early_deduction
      });

      company = await CompanySettingModel.findOne({
        where: { company_id: companyId }
      });
      if (company) {
        return this.res
          .status(400)
          .json(response(false, `Failed, company settings with id ${companyId} has already exist`));
      }
      company = await CompanySettingModel.create(settingPayload);

      const employee = await EmployeeModel.create({
        company_id: companyId,
        salary: null,
        user_id,
        role: 1,
        flag: 3,
        gajiandulu_status: 0
      });

      await UserModel.update({ registration_complete: 1 }, { where: { id: user_id } });

      await CompanyModel.update({ registration_complete: 1 }, { where: { id: companyId } });

      // Create Ability Record
      await Ability.create({ employee_id: employee.id });

      company.dataValues.employee_id = employee.id;
      company.dataValues.role = employee.role;

      // SEND NOTIFICATION WELCOME
      observe.emit(EVENT.SEND_WELCOME, {
        userId: user_id,
        employeeId: employee.id
      });

      return this.res
        .status(200)
        .json(response(true, 'Company settings has been successfully saved', company));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }

  async updateSettings() {
    const { data } = this.req.body;
    const { company_id } = this.req.params;
    const transaction = await sequelize.transaction();
    try {
      const checkCompany = await CompanySettingModel.findOne({ where: { company_id } });
      if (!checkCompany) {
        return this.res.status(400).json(response(false, 'Perusahaan tidak ditemukan'));
      }
      // Update Company Settings
      if (
        checkCompany.payroll_date !== data.payroll_date &&
        checkCompany.payroll_date !== null &&
        checkCompany.payroll_date !== 0
      ) {
        const checkCronPayrollDate = await CronPayrollDate.findOne({ where: { company_id } });
        if (checkCronPayrollDate) {
          const updateCronPayrollDate = await CronPayrollDate.update(
            { payroll_date: data.payroll_date },
            { where: { id: checkCronPayrollDate.id } },
            { transaction }
          );
          if (!updateCronPayrollDate) {
            await transaction.rollback();
            return this.res
              .status(400)
              .json(response(false, 'Gagal mengubah peraturan perusahaan'));
          }
        } else {
          const createCronPayrollDate = await CronPayrollDate.create(
            { company_id, payroll_date: data.payroll_date },
            { transaction }
          );
          if (!createCronPayrollDate) {
            await transaction.rollback();
            return this.res
              .status(400)
              .json(response(false, 'Gagal mengubah peraturan perusahaan'));
          }
        }
        delete data.payroll_date;
        const updateCompanySettings = await CompanySettingModel.update(
          data,
          { where: { company_id } },
          { transaction }
        );
        if (!updateCompanySettings) {
          await transaction.rollback();
          return this.res.status(400).json(response(false, 'Gagal mengubah peraturan perusahaan'));
        }
      } else {
        const updateCompanySettings = await CompanySettingModel.update(data, {
          where: { company_id },
          transaction
        });
        if (!updateCompanySettings) {
          await transaction.rollback();
          return this.res.status(400).json(response(false, 'Gagal mengubah peraturan perusahaan'));
        }
        // Check is Has Cron Payroll Date
        const checkCronPayrollDate = await CronPayrollDate.findOne({ where: { company_id } });
        // Delete Cron Payroll Date
        if (checkCronPayrollDate) {
          const deleteCronPayrollDate = await CronPayrollDate.destroy({
            where: { company_id },
            transaction
          });
          if (!deleteCronPayrollDate) {
            await transaction.rollback();
            return this.res
              .status(400)
              .json(response(false, 'Gagal mengubah peraturan perusahaan'));
          }
        }
      }
      await transaction.commit();
      return this.res.status(200).json(response(true, 'Peraturan peruahaan berhasil diubah'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }

  async getSettings() {
    const { company_id } = this.req.params;
    const dateNow = dateConverter(new Date());
    try {
      const checkCompany = await CompanyModel.findOne({ where: { id: company_id } });
      if (!checkCompany) {
        return this.res.status(400).json(response(false, 'Perusahaan tidak ditemukan'));
      }
      const getCompanySetting = await CompanySettingModel.findOne({ where: { company_id } });
      if (!getCompanySetting) {
        return this.res.status(400).json(response(false, 'Gagal mendapatkan setting perusahaan'));
      }
      const getCronPayrollDate = await CronPayrollDate.findOne({ where: { company_id } });
      // Get Company Subscribement
      const subscribements = await Subscribement.findAll({
        where: {
          company_id,
          date_to_deactive: { [Op.gte]: dateNow },
          date_to_active: { [Op.lte]: dateNow }
        },
        include: [
          { model: Transaction, where: { payment_status: '00' }, attributes: [] },
          { model: Package, include: { model: PackageDetail } }
        ]
      });

      let abilities = [];
      if (subscribements.length) {
        for (const data of subscribements) {
          for (const ability of data.package.package_details) {
            abilities.push(ability.ability);
          }
        }
      }

      const responses = {
        company_id: getCompanySetting.company_id,
        payroll_date: getCompanySetting.payroll_date,
        cron_payroll_date: getCronPayrollDate ? getCronPayrollDate.payroll_date : null,
        presence_overdue_limit: getCompanySetting.presence_overdue_limit,
        rest_limit: getCompanySetting.rest_limit,
        ceklok_radius: getCompanySetting.ceklok_radius,
        leave_quota: getCompanySetting.leave_quota,
        leave_amount: getCompanySetting.leave_amount,
        late_deduction: getCompanySetting.late_deduction,
        home_early_deduction: getCompanySetting.home_early_deduction,
        overwork_limit: getCompanySetting.overwork_limit,
        selfie_checklog: getCompanySetting.selfie_checklog,
        abilities
      };
      return this.res
        .status(200)
        .json(response(true, 'Peraturan peruahaan berhasil didapatkan', responses));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
  async updateNotification() {
    const { company_ids } = this.req.params;
    const { data } = this.req.body;
    const companyIds = company_ids.split(',');
    try {
      const updateNotificationSetting = await CompanySettingModel.update(data, {
        where: {
          company_id: companyIds
        }
      });
      if (!updateNotificationSetting) {
        return this.res.status(400).json(response(false, 'Gagal mengubah pengaturan notifikasi'));
      }
      return this.res.status(200).json(response(true, 'Peraturan notifikasi berhasil diubah'));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }

  async getNotificationSetting() {
    const { company_id } = this.req.params;
    try {
      const getNotificationSettings = await CompanySettingModel.findOne({
        where: { company_id },
        attributes: ['notif_presence_overdue', 'notif_overwork', 'notif_work_schedule']
      });
      if (!getNotificationSettings) {
        return this.res.status(400).json(response(false, 'Tidak ada data pengaturan notifikasi'));
      }
      return this.res
        .status(200)
        .json(response(true, 'Peraturan notifikasi berhasil didapatkan', getNotificationSettings));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
  async getCompanyInfo() {
    const { company_id } = this.req.params;
    const { id: userId, companyParentId } = this.res.local.users;
    const dateNow = dateConverter(new Date());
    let assets;
    try {
      const company = await CompanyModel.findOne({ where: { id: company_id } });
      if (!company) {
        return this.res
          .status(400)
          .json(response(false, `Company with id ${company_id} is not found`));
      }

      const userData = await EmployeeModel.findOne({
        where: { company_id, user_id: userId },
        order: [['id', 'desc']],
        include: [
          {
            model: UserModel
          }
        ]
      });
      if (userData) {
        assets = await DigitalAssetModel.findAll({
          where: {
            uploadable_id: userData.id,
            uploadable_type: 'employees',
            type: 'avatar'
          }
        });
      }
      const companySetting = await CompanySettingModel.findOne({
        where: { company_id }
      });

      const companyBranches = await CompanyModel.findAll({
        where: {
          parent_company_id: companyParentId
        },
        attributes: [
          'id',
          'company_name',
          'name',
          'address',
          'phone',
          'location',
          'codename',
          'active'
        ],
        include: [
          {
            model: Subscribement,
            required: false,
            where: {
              date_to_deactive: { [Op.gte]: dateNow },
              date_to_active: { [Op.lte]: dateNow }
            },
            limit: 1,
            include: [{ model: Transaction, where: { payment_status: '00' }, attributes: [] }]
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
          id: userData ? userData.id : null,
          role: userData ? userData.role : null,
          full_name: userData ? userData.user.full_name : null,
          email: userData ? userData.user.email : null,
          phone: userData ? userData.user.phone : null,
          active: userData ? userData.active : null,
          assets
        },
        setting: companySetting,
        company_branch: companyBranches
      };

      return this.res
        .status(200)
        .json(response(true, 'Company info has been successfully retrieved', results));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
}

module.exports = companySettingService;

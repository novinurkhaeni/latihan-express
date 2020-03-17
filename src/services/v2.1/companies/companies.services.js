require('module-alias/register');
const { response } = require('@helpers');
const {
  Sequelize: { Op }
} = require('sequelize');
const {
  sequelize,
  salary_groups: SalaryGroups,
  companies: CompanyModel,
  company_settings: CompanySettings,
  cron_salary_groups: CronSalaryGroup,
  users: User,
  allowance: Allowance,
  employees: Employee,
  digital_assets: DigitalAsset,
  schedule_shifts: ScheduleShift
} = require('@models');
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const companiesService = {
  createSalaryGroup: async (req, res) => {
    const { data } = req.body;
    const { company_id } = req.params;
    const { id, employeeId } = res.local.users;
    const transaction = await sequelize.transaction();

    try {
      // 1 Find related company
      const checkCompany = await CompanyModel.findOne({ where: { id: company_id } });
      if (!checkCompany) {
        return res.status(400).json(response(false, 'Id company tidak ditemukan'));
      }
      const checkuser = await User.findOne({ where: { id } });

      // 2 Create salary group
      const payload = data;
      Object.assign(payload, { company_id });
      const salaryGroup = await SalaryGroups.create(payload, { transaction });

      // 3 update schedule_shift
      if (payload.salary_type == 2) {
        if (!payload.schedule_shift_id) {
          await transaction.rollback();
          return res
            .status(422)
            .json(
              response(
                false,
                'post with salary_type 2 must including appropriate schedule_shift_id'
              )
            );
        }
        const shift = await ScheduleShift.find({ where: { id: payload.schedule_shift_id } });
        if (!shift) {
          await transaction.rollback();
          return res.status(422).json(response(false, 'not appropriate schedule_shift_id'));
        }
        await shift.update({ salary_group_id: salaryGroup.dataValues.id }, { transaction });
      }

      // 4 save to allowances
      let allowance = [];
      const dailyAllowance = data.daily_allowance;
      if (dailyAllowance.length > 0) {
        allowance = allowance.concat(dailyAllowance);
      }
      const monthlyAllowance = data.monthly_allowance;
      if (monthlyAllowance.length > 0) {
        allowance = allowance.concat(monthlyAllowance);
      }

      if (allowance.length > 0) {
        allowance.forEach(al => (al.salary_groups_id = salaryGroup.id));
        await Allowance.bulkCreate(allowance, { transaction });
      }
      if (!salaryGroup) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal membuat golongan gaji'));
      }

      // 5 SEND NOTIFICATION TO MANAGERS
      const description = `${checkuser.full_name} telah membuat golongan gaji dengan nama: ${salaryGroup.salary_name}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });

      // 6 commit and return
      await transaction.commit();
      return res.status(200).json(response(true, 'Golongan gaji berhasil dibuat'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getSalaryGroup: async (req, res) => {
    const { company_id } = req.params;
    const companyIdArr = company_id.split(',');
    try {
      const checkCompany = await CompanyModel.findAll({
        where: { id: companyIdArr }
      });
      if (checkCompany.length <= 0) {
        return res.status(400).json(response(false, 'Id company tidak ditemukan'));
      }
      const salaryGroup = await SalaryGroups.findAll({
        attributes: ['salary_name', 'id', 'salary_type'],
        where: { company_id: companyIdArr },
        include: [
          { model: CronSalaryGroup, required: false },
          {
            model: CompanyModel,
            attributes: ['id', 'codename', 'company_name', 'name']
          }
        ]
      });
      if (salaryGroup.length === 0) {
        return res.status(400).json(response(false, 'Golongan gaji tidak tersedia'));
      }
      return res.status(200).json(response(true, 'Golongan gaji berhasil dimuat', salaryGroup));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getSalaryGroupDetail: async (req, res) => {
    const { salary_group_id: salaryGroupId } = req.params;
    try {
      const salaryGroup = await SalaryGroups.findOne({
        where: { id: salaryGroupId },
        include: [
          {
            model: Allowance
          }
        ]
      });
      if (!salaryGroup) {
        return res.status(400).json(response(false, 'Golongan gaji tidak ditemukan'));
      }

      let allowances = salaryGroup.allowances;
      let dailyAllowance = allowances.filter(allowance => allowance.type === 1);
      let monthlyAllowance = allowances.filter(allowance => allowance.type === 2);
      const payload = Object.assign({}, salaryGroup.dataValues, {
        daily_allowance: dailyAllowance,
        monthly_allowance: monthlyAllowance
      });
      delete payload.transport_allowance;
      delete payload.lunch_allowance;
      delete payload.allowances;

      return res.status(200).json(response(true, 'Detail golongan gaji berhasil dimuat', payload));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  editSalaryGroup: async (req, res) => {
    const { salary_group_id: salaryGroupId } = req.params;
    const { data } = req.body;
    const { id, employeeId } = res.local.users;
    const transaction = await sequelize.transaction();
    try {
      // 1 Find salary groups
      const salaryGroup = await SalaryGroups.findOne({ where: { id: salaryGroupId } });
      if (!salaryGroup) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Golongan gaji tidak ditemukan'));
      }
      const checkUser = await User.findOne({ where: { id } });

      // 2 Update salary groups
      const editSalaryGroup = await SalaryGroups.update(data, {
        where: { id: salaryGroupId },
        transaction
      });
      if (!editSalaryGroup) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Golongan gaji gagal diubah'));
      }

      // 3 update schedule_shift
      if (data.salary_type == 2 && data.schedule_shift_id) {
        const shift = await ScheduleShift.find({ where: { id: data.schedule_shift_id } });
        if (!shift) {
          await transaction.rollback();
          return res.status(422).json(response(false, 'not appropriate schedule_shift_id'));
        }
        await shift.update({ salary_group_id: salaryGroup.dataValues.id }, { transaction });
      }

      // DESTROY DAILY SALARY AND MONTHLY SALARY
      await Allowance.destroy({ where: { salary_groups_id: salaryGroupId }, transaction });

      // INSERT NEW ALLOWANCE DATA
      let allowance = [];
      const dailyAllowance = data.daily_allowance;
      if (dailyAllowance.length > 0) {
        allowance = allowance.concat(dailyAllowance);
      }
      const monthlyAllowance = data.monthly_allowance;
      if (monthlyAllowance.length > 0) {
        allowance = allowance.concat(monthlyAllowance);
      }
      if (allowance.length > 0) {
        allowance.forEach(al => (al.salary_groups_id = salaryGroup.id));
        await Allowance.bulkCreate(allowance, { transaction });
      }

      // SEND NOTIFICATION TO MANAGERS
      const description = `${checkUser.full_name} telah mengubah golongan gaji dengan nama ${salaryGroup.salary_name}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });

      await transaction.commit();
      return res.status(200).json(response(true, 'Golongan gaji telah berhasil diubah'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  // GET COMPANY DETAIL
  getDetail: async (req, res) => {
    const { company_id } = req.params;
    const managers = [];
    const supervisors = [];
    try {
      const company = await CompanyModel.findOne({
        where: { id: company_id },
        include: [
          { model: CompanySettings, as: 'setting' },
          {
            model: Employee,
            attributes: ['id', 'role'],
            where: {
              role: {
                [Op.or]: [1, 3]
              }
            },
            include: [
              { model: User, attributes: ['full_name'] },
              {
                model: DigitalAsset,
                required: false,
                attributes: ['url', 'type'],
                where: {
                  type: 'avatar'
                },
                as: 'assets'
              }
            ],
            required: false
          }
        ]
      });

      if (company.employees) {
        for (const employee of company.employees) {
          if (employee.role === 1) {
            managers.push({
              id: employee.id,
              full_name: employee.user.full_name,
              avatar: employee.assets
            });
          }
          if (employee.role === 3) {
            supervisors.push({
              id: employee.id,
              full_name: employee.user.full_name,
              avatar: employee.assets
            });
          }
        }
      }

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
        managers: managers,
        supervisors: supervisors,
        setting: company.setting
      };
      return res.status(200).json(response(true, 'Golongan gaji berhasil dimuat', results));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = companiesService;

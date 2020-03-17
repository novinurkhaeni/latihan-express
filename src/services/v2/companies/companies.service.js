require('module-alias/register');
const { response } = require('@helpers');
const {
  salary_groups: SalaryGroups,
  salary_details: SalaryDetails,
  companies: CompanyModel,
  cron_salary_groups: CronSalaryGroup,
  users: User
} = require('@models');
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const companiesService = {
  createSalaryGroup: async (req, res) => {
    const { data } = req.body;
    const { company_id } = req.params;
    const { id, employeeId } = res.local.users;
    try {
      const checkCompany = await CompanyModel.findOne({ where: { id: company_id } });
      if (!checkCompany) {
        return res.status(400).json(response(false, 'Id company tidak ditemukan'));
      }
      const checkuser = await User.findOne({ where: { id } });
      const payload = data;
      Object.assign(payload, { company_id });
      const salaryGroup = await SalaryGroups.create(payload);
      if (!salaryGroup) {
        return res.status(400).json(response(false, 'Gagal membuat golongan gaji'));
      }
      // SEND NOTIFICATION TO MANAGERS
      const description = `${checkuser.full_name} telah membuat golongan gaji dengan nama: ${salaryGroup.salary_name}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      return res.status(200).json(response(true, 'Golongan gaji berhasil dibuat'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getSalaryGroup: async (req, res) => {
    const { company_id: companyId } = req.params;
    try {
      const checkCompany = await CompanyModel.findOne({ where: { id: companyId } });
      if (!checkCompany) {
        return res.status(400).json(response(false, 'Id company tidak ditemukan'));
      }
      const salaryGroup = await SalaryGroups.findAll({
        where: { company_id: companyId },
        attributes: ['salary_name', 'id', 'salary_type'],
        include: { model: CronSalaryGroup, required: false }
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
      const salaryGroup = await SalaryGroups.findOne({ where: { id: salaryGroupId } });
      if (!salaryGroup) {
        return res.status(400).json(response(false, 'Golongan gaji tidak ditemukan'));
      }
      return res
        .status(200)
        .json(response(true, 'Detail golongan gaji berhasil dimuat', salaryGroup));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  checkSalaryGroupUses: async (req, res) => {
    const { salaryId: salaryGroupId } = req.params;
    try {
      const salaryDetails = await SalaryDetails.findOne({ where: { salary_id: salaryGroupId } });
      if (!salaryDetails) {
        return res.status(200).json(
          response(true, 'Golongan gaji belum digunakan', {
            salary_group_used: false
          })
        );
      }
      return res
        .status(200)
        .json(response(true, 'Golongan gaji sudah digunakan', { salary_group_used: true }));
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
    try {
      let addCornSalaryGroup;
      const salaryGroup = await SalaryGroups.findOne({ where: { id: salaryGroupId } });
      if (!salaryGroup) {
        return res.status(400).json(response(false, 'Golongan gaji tidak ditemukan'));
      }
      const checkUser = await User.findOne({ where: { id } });
      //if Request Query type instant
      if (req.query.type === 'instant') {
        const editSalaryGroup = await SalaryGroups.update(data, { where: { id: salaryGroupId } });
        if (!editSalaryGroup) {
          return res.status(400).json(response(false, 'Golongan gaji gagal diubah'));
        }
        // SEND NOTIFICATION TO MANAGERS
        const description = `${checkUser.full_name} telah mengubah golongan gaji dengan nama ${salaryGroup.salary_name}`;
        observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
          employeeId,
          description
        });
        return res.status(200).json(response(true, 'Golongan gaji berhasil diubah'));
      }
      //if Request Query type delay
      const payload = Object.assign({}, data, {
        company_id: salaryGroup.company_id,
        salary_id: salaryGroupId
      });
      const cronSalaryGroup = await CronSalaryGroup.findOne({
        where: { salary_id: salaryGroupId }
      });
      if (cronSalaryGroup) {
        addCornSalaryGroup = await CronSalaryGroup.update(payload, {
          where: { id: cronSalaryGroup.id }
        });
      } else {
        addCornSalaryGroup = await CronSalaryGroup.create(payload);
      }

      if (!addCornSalaryGroup) {
        return res.status(400).json(response(false, 'Golongan gaji gagal diubah'));
      }
      return res
        .status(200)
        .json(response(true, 'Golongan gaji akan berubah setelah tanggal tutup buku'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  deleteSalaryGroup: async (req, res) => {
    const { salary_group_id: salaryGroupId } = req.params;
    const { id, employeeId } = res.local.users;
    try {
      const checkUser = await User.findOne({ where: { id } });
      const salaryGroup = await SalaryGroups.findOne({ where: { id: salaryGroupId } });
      if (!salaryGroup) {
        return res.status(400).json(response(false, 'Golongan gaji tidak ditemukan'));
      }
      const deleteSalaryGroup = await SalaryGroups.destroy({ where: { id: salaryGroupId } });
      if (!deleteSalaryGroup) {
        return res.status(400).json(response(false, 'Golongan gaji gagal dihapus'));
      }
      // SEND NOTIFICATION TO MANAGERS
      const description = `${checkUser.full_name} telah menghapus golongan gaji dengan nama ${salaryGroup.salary_name}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      return res.status(200).json(response(true, 'Golongan gaji berhasil dihapus'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = companiesService;

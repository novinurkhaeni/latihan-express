require('module-alias/register');
const Sequelize = require('sequelize');
const { response } = require('@helpers');
const {
  companies: CompanyModel,
  employees: EmployeeModel,
  schedule_shifts: ScheduleShift,
  salary_groups: SalaryGroup
} = require('@models');

const shiftService = {
  getShift: async (req, res) => {
    const { company_id: companyId } = req.params;
    const companyIdArr = companyId.split(',');
    try {
      const companyData = await CompanyModel.findAll({ where: { id: companyIdArr } });
      if (companyData.length <= 0) {
        return res.status(400).json(response(false, 'wrong company ID'));
      }
      const shiftData = await ScheduleShift.findAll({
        where: [{ company_id: companyIdArr, is_deleted: 0 }],
        include: [
          {
            model: CompanyModel,
            attributes: ['id', 'codename', 'company_name', 'name']
          },
          { model: SalaryGroup }
        ],
        order: [[Sequelize.col('company.id'), 'ASC']]
      });
      const responses = [];
      shiftData.forEach(val => {
        const compose = {
          id: val.id,
          company_id: val.company_id,
          shift_name: val.shift_name,
          shift_multiply: val.shift_multiply,
          start_time: val.start_time,
          end_time: val.end_time,
          is_tommorow: val.is_tommorow,
          salary: val.salary,
          company: val.company.company_name || val.company.name,
          color: val.color,
          use_salary_per_shift: val.use_salary_per_shift,
          salary_group: val.salary_group
        };
        responses.push(compose);
      });
      if (!shiftData.length) {
        return res.status(400).json(response(false, 'Tidak ada data waktu kerja'));
      }
      responses.sort((prev, next) => {
        // Sort By Clock ASC
        if (prev.start_time < next.start_time) return -1;
        if (prev.start_time > next.start_time) return 1;
      });
      return res.status(201).json(response(true, 'Berhasil memuat waktu kerja kerja', responses));
    } catch (error) {
      return res.status(400).json(response(false, error.errors));
    }
  },

  deleteCompanyBranch: async (req, res) => {
    const { company_id } = req.params;
    try {
      const checkCompany = await CompanyModel.findOne({ where: { id: company_id } });
      if (!checkCompany) throw new Error(`Company ID ${company_id} does NOT exist!`);
      let companyCode = checkCompany.codename;

      // Check if company has employees registered
      const hasMember = await EmployeeModel.count({ where: { company_id: company_id } });
      if (hasMember > 0) {
        throw new Error(
          `Failed to delete company branch: ${companyCode} still has ${hasMember} registered employees!`
        );
      }

      const deleteCompany = await CompanyModel.destroy({ where: { id: company_id } });
      if (!deleteCompany) throw new Error(`Error sequelize when delete company id: ${company_id}`);

      return res.status(200).json(response(true, `Success delete company branch: ${companyCode}`));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      } else {
        return res.status(400).json(response(false, error.message));
      }
    }
  }
};

module.exports = shiftService;

require('module-alias/register');
const { response } = require('@helpers');
const {
  salary_groups: SalaryGroups,
  companies: CompanyModel,
  schedule_shifts: ScheduleShift
} = require('@models');

class SalaryGroup {
  constructor(req, res) {
    this.req = req;
    this.res = res;
  }
  async getSalaryGroup() {
    const {
      params: { company_ids },
      query: { type }
    } = this.req;
    const companyIdArr = company_ids.split(',');
    let salaryGroup = [];
    try {
      const checkCompany = await CompanyModel.findAll({
        where: { id: companyIdArr }
      });
      if (checkCompany.length <= 0) {
        return this.res.status(400).json(response(false, 'Id company tidak ditemukan'));
      }
      // Monthly
      if (type === '1') {
        salaryGroup = await SalaryGroups.findAll({
          attributes: ['salary_name', 'id', 'salary_type', 'salary'],
          where: { company_id: companyIdArr, salary_type: 1 }
        });
      }
      // Shift
      if (type === '2') {
        salaryGroup = await ScheduleShift.findAll({
          attributes: ['id', 'shift_name', 'start_time', 'end_time'],
          where: { company_id: companyIdArr, is_deleted: 0, use_salary_per_shift: 1 },
          include: {
            model: SalaryGroups,
            attributes: ['id', 'salary_name', 'salary', 'salary_type']
          }
        });
      }

      // All
      if (!type) {
        const monthlySalaryGroup = await SalaryGroups.findAll({
          attributes: ['salary_name', 'id', 'salary_type', 'salary'],
          where: { company_id: companyIdArr, salary_type: 1 }
        });
        const shiftSalaryGroup = await ScheduleShift.findAll({
          attributes: ['id', 'shift_name', 'start_time', 'end_time'],
          where: { company_id: companyIdArr, is_deleted: 0, use_salary_per_shift: 1 },
          include: {
            model: SalaryGroups,
            attributes: ['id', 'salary_name', 'salary', 'salary_type']
          }
        });
        salaryGroup = monthlySalaryGroup.concat(shiftSalaryGroup);
      }

      return this.res
        .status(200)
        .json(response(true, 'Golongan gaji berhasil dimuat', salaryGroup));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
}

module.exports = SalaryGroup;

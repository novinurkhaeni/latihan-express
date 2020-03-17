require('module-alias/register');
const { response } = require('@helpers');
const { schedule_shifts: ScheduleShift, companies: Company } = require('@models');

class Shift {
  constructor(req, res) {
    this.req = req;
    this.res = res;
  }

  async createShift() {
    const {
      params: { company_id },
      body: { data }
    } = this.req;
    try {
      // Check Branch
      const checkCompany = await Company.findOne({ where: { id: company_id } });
      if (!checkCompany) {
        return this.res.status(400).json(response(false, 'Tim tidak ditemukan'));
      }
      // Insert Shift
      const payload = {
        company_id,
        shift_name: data.shift_name,
        start_time: data.start_time,
        end_time: data.end_time,
        is_tommorow: data.is_tommorow,
        color: data.color,
        use_salary_per_shift: data.use_salary_per_shift
      };
      const insertShift = await ScheduleShift.create(payload);
      if (!insertShift) {
        return this.res.status(400).json(response(false, 'Gagal membuat shift baru'));
      }
      return this.res.status(201).json(response(false, 'Shift berhasil disimpan'));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
}

module.exports = Shift;

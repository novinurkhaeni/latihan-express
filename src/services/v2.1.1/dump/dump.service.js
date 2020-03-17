require('module-alias/register');
const { response } = require('@helpers');
const { home_dumps: HomeDump, employees: Employee } = require('@models');

const dump = {
  post: async (req, res) => {
    const { data } = req.body;
    const { companyParentId } = res.local.users;
    try {
      // Check Employee
      const employee = await Employee.findOne({ where: { id: data.employee_id, active: 1 } });
      if (!employee) return res.status(400).json(response(false, `Anggota tidak ditemukan`));
      // Insert Record
      const homeDump = await HomeDump.create({ ...data, parent_company_id: companyParentId });
      if (!homeDump) return res.status(400).json(response(false, `Gagal membuat perubahan`));
      return res.status(201).json(response(true, `Berhasil membuat perubahan`));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = dump;

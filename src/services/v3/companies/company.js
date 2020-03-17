require('module-alias/register');
const { response } = require('@helpers');
const { companies: Company } = require('@models');

class CompanyService {
  constructor(req, res) {
    this.req = req;
    this.res = res;
  }

  async deactive() {
    const { company_ids } = this.req.params;
    const companyIds = company_ids.split(',');
    try {
      const updateCompanies = await Company.update({ active: 0 }, { where: { id: companyIds } });
      if (!updateCompanies) {
        return this.res.status(400).json(response(false, 'Gagal menonaktifkan perusahaan'));
      }
      return this.res.status(200).json(response(true, 'Berhasil menonaktifkan perusahaan'));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
}

module.exports = CompanyService;

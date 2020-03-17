require('module-alias/register');
const { response } = require('@helpers');
const { companies: CompanyModel } = require('@models');

const companyService = {
  patchRenewCompany: async (req, res) => {
    const { companyId } = req.params;
    const { data: renewData } = req.body;
    const companyID = companyId.split(',');

    try {
      const companyData = await CompanyModel.findAll({ where: { id: companyID } });
      if (companyData.length <= 0) {
        return res.status(400).json(response(false, 'wrong company ID'));
      }

      const employeePayload = { renew: renewData.renew };

      companyData.forEach(async data => {
        const createRenew = await CompanyModel.update(employeePayload, {
          where: { id: data.id }
        });
        if (!createRenew) {
          return res.status(400).json(response(false, 'Gagal update company'));
        }
      });
      return res.status(200).json(response(true, 'Company berhasil di update'));
    } catch (error) {
      return res.status(400).json(response(false, error.errors));
    }
  }
};

module.exports = companyService;

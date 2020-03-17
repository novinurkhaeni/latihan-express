require('module-alias/register');
const { packages: Package, package_details: PackageDetail } = require('@models');
const { response } = require('@helpers');

const packages = {
  get: async (req, res) => {
    try {
      const packages = await Package.findAll({
        attributes: { exclude: ['created_at', 'updated_at'] },
        include: {
          model: PackageDetail,
          attributes: { exclude: ['created_at', 'updated_at', 'package_id'] }
        }
      });
      const responses = [];
      for (const data of packages) {
        responses.push({
          id: data.id,
          name: data.name,
          price: data.price,
          daily_price: Math.round(data.price / 31),
          icon: data.icon,
          type: data.type,
          package_details: data.package_details
        });
      }
      return res.status(200).json(response(true, 'Daftar paket berhasil didapatkan', responses));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = packages;

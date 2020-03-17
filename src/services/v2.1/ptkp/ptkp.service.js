require('module-alias/register');
const { response } = require('@helpers');
const { ptkp: Ptkp, ptkp_details: PtkpDetails } = require('@models');

const ptkpService = {
  get: async (req, res) => {
    try {
      const ptkp = await Ptkp.findAll({
        attributes: ['id', 'name']
      });
      if (ptkp.length <= 0) {
        return res.status(400).json(response(false, 'Data PTKP tidak ditemukan'));
      }
      return res.status(200).json(response(true, 'Data PTKP berhasil dimuat', ptkp));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getDetail: async (req, res) => {
    const { ptkpId } = req.params;
    try {
      const ptkpDetails = await PtkpDetails.findAll({
        attributes: ['id', 'name', 'amount'],
        where: { ptkp_id: ptkpId }
      });
      if (ptkpDetails.length <= 0) {
        return res.status(400).json(response(false, 'Detail PTKP tidak ditemukan'));
      }
      return res.status(200).json(response(true, 'Detail PTKP berhasil dimuat', ptkpDetails));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = ptkpService;

require('module-alias/register');
const { response } = require('@helpers');
const { promos: Promo } = require('@models');
const Sequelize = require('sequelize');

const promoService = {
  apply: async (req, res) => {
    const { code } = req.body.data;
    const date = new Date();
    const thisDate = `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(
      -2
    )}-${date.getDate()}`;
    let promo;

    try {
      promo = await Promo.findOne({ where: { code: code } });
      if (!promo) {
        return res.status(400).json(response(false, 'Tidak ditemukan promo yang tersedia'));
      }
      promo = await Promo.findOne({
        where: { code: code, expired_date: { $gte: thisDate } }
      });
      if (!promo) {
        return res.status(400).json(response(false, 'Promo sudah kadaluarsa'));
      }
      promo = await Promo.findOne({
        where: [
          Sequelize.where(Sequelize.col('usage'), '<', Sequelize.col('limit')),
          { code: code, expired_date: { $gte: thisDate } }
        ]
      });
      if (!promo) {
        return res.status(400).json(response(false, 'Promo sudah melebihi batas penggunaan'));
      }

      promo = await Promo.findOne({ where: { code: code } });

      return res.status(200).json(response(true, 'Promo berhasil didapat', promo));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = promoService;

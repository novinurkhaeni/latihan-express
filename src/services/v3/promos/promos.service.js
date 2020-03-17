require('module-alias/register');
const {
  Sequelize: { Op }
} = require('sequelize');
const {
  promos: Promos,
  promo_details: PromoDetails,
  promo_privates: PromoPrivate
} = require('@models');
const { response, dateConverter } = require('@helpers');

const promosService = {
  get: async (req, res) => {
    const { employeeId } = res.local.users;
    const { typeOfUse } = req.query;
    try {
      const today = dateConverter(new Date());
      const promos = await Promos.findAll({
        attributes: [
          'id',
          'code',
          'type',
          'amount',
          'effective_date',
          'expired_date',
          'limit',
          'usage'
        ],
        where: {
          effective_date: { [Op.lte]: today },
          expired_date: { [Op.gte]: today },
          visibility: 'public',
          [Op.or]: [{ type_of_use: 'general' }, { type_of_use: typeOfUse }]
        },
        include: { model: PromoDetails, where: { employee_id: employeeId }, required: false }
      });

      const privatePromo = await Promos.findAll({
        attributes: [
          'id',
          'code',
          'type',
          'amount',
          'effective_date',
          'expired_date',
          'limit',
          'usage'
        ],
        where: {
          visibility: 'private',
          [Op.or]: [{ type_of_use: 'general' }, { type_of_use: typeOfUse }]
        },
        include: {
          model: PromoPrivate,
          required: true,
          where: { expired_at: { [Op.gte]: today } }
        }
      });

      const responses = [];
      for (const data of promos) {
        responses.push({
          id: data.id,
          code: data.code,
          type: data.type,
          amount: data.amount,
          effective_date: data.effective_date,
          expired_date: data.expired_date,
          limit: data.limit,
          usage: data.usage,
          is_used: data.promo_detail !== null
        });
      }
      for (const data of privatePromo) {
        responses.push({
          id: data.id,
          code: data.code,
          type: data.type,
          amount: data.amount,
          effective_date: data.promo_private.created_at.split(' ')[0],
          expired_date: data.promo_private.expired_at,
          limit: data.limit,
          usage: data.promo_private.usage,
          is_used: data.promo_private.usage >= data.limit
        });
      }
      return res
        .status(200)
        .json(response(true, 'Daftar kode promo berhasil didapatkan', responses));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  check: async (req, res) => {
    const { code } = req.query;
    const { employeeId } = res.local.users;
    try {
      const today = dateConverter(new Date());
      const promo = await Promos.findOne({
        where: { code, visibility: 'public' },
        attributes: [
          'id',
          'code',
          'type',
          'amount',
          'visibility',
          'effective_date',
          'expired_date',
          'limit',
          'usage'
        ],
        include: {
          model: PromoDetails,
          where: { employee_id: employeeId },
          required: false
        }
      });

      const private = await Promos.findOne({
        where: { code, visibility: 'private' },
        attributes: [
          'id',
          'code',
          'type',
          'visibility',
          'amount',
          'effective_date',
          'expired_date',
          'limit',
          'usage'
        ],
        include: { model: PromoPrivate, required: true }
      });

      if (!promo && !private) {
        return res.status(400).json(response(false, 'Kode promo tidak ditemukan'));
      }
      if (
        (promo && promo.usage >= promo.limit) ||
        (private && private.promo_private.usage >= private.limit)
      ) {
        return res.status(400).json(response(false, 'Kode promo sudah tidak dapat digunakan'));
      }
      if (
        (promo && promo.effective_date > today && promo.expired_date > today) ||
        (private && private.promo_private.expired_at < today)
      ) {
        return res.status(400).json(response(false, 'Kode promo belum berlaku'));
      }
      if (
        (promo && promo.effective_date < today && promo.expired_date < today) ||
        (private && private.promo_private.expired_at < today)
      ) {
        return res.status(400).json(response(false, 'Kode promo sudah tidak berlaku'));
      }
      if (promo && promo.promo_detail !== null) {
        return res
          .status(400)
          .json(response(false, 'Anda sudah pernah menggunakan kode promo ini'));
      }
      const responses = {
        id: (promo && promo.id) || private.id,
        code: (promo && promo.code) || private.code,
        type: (promo && promo.type) || private.type,
        visibility: (promo && promo.dataValues.visibility) || private.dataValues.visibility,
        amount: (promo && promo.amount) || private.amount,
        effective_date:
          (promo && promo.effective_date) || private.promo_private.created_at.split(' ')[0],
        expired_date: (promo && promo.expired_date) || private.promo_private.expired_at,
        limit: (promo && promo.limit) || private.limit,
        usage: (promo && promo.usage) || private.usage
      };

      return res.status(200).json(response(true, 'Kode promo berhasil didapatkan', responses));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  createPrivate: async (req, res) => {
    const { data } = req.body;
    const { companyParentId } = res.local.users;
    let expiredAt = new Date();
    expiredAt = new Date(expiredAt.setMonth(expiredAt.getMonth() + 3));
    try {
      // Find Promo
      const privatePromo = await Promos.findOne({
        attributes: [
          'id',
          'code',
          'type',
          'amount',
          'effective_date',
          'expired_date',
          'limit',
          'usage'
        ],
        where: { code: data.promo_code, visibility: 'private' }
      });
      if (!privatePromo) {
        return res.status(400).json(response(false, 'Kode promo tidak ditemukan'));
      }
      const payload = {
        parent_company_id: companyParentId,
        promo_id: privatePromo.id,
        expired_at: expiredAt
      };
      const createPrivatePromo = await PromoPrivate.create(payload);
      if (!createPrivatePromo) {
        return res.status(400).json(response(false, 'Gagal menyimpan voucher'));
      }
      return res.status(201).json(response(true, 'Voucher berhasil ditambahkan'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = promosService;

require('module-alias/register');
const { response, dateConverter } = require('@helpers');
const {
  Sequelize: { Op }
} = require('sequelize');
const { periodic_pieces: PeriodicPiece, employees: Employee, users: User } = require('@models');

class PeriodicPieces {
  constructor(req, res) {
    this.req = req;
    this.res = res;
  }

  async getPeriodicPieces() {
    const {
      params: { company_ids }
    } = this.req;
    const companyIds = company_ids.split(',');
    const today = dateConverter(new Date(new Date().setHours(new Date().getHours() + 7)));
    try {
      const periodicPieces = await PeriodicPiece.findAll({
        where: { start: { [Op.lte]: today }, end: { [Op.gte]: today } },
        include: {
          model: Employee,
          required: true,
          where: { company_id: companyIds },
          attributes: ['id'],
          include: { model: User, attributes: ['full_name'] }
        }
      });
      if (!periodicPieces) {
        return this.res
          .status(400)
          .json(response(false, 'Gagal mendapatkan daftar potongan berkala'));
      }
      const responses = [];
      for (const data of periodicPieces) {
        responses.push({
          id: data.id,
          notes: data.note,
          amount: data.amount,
          employee: data.employee,
          created_at: data.created_at
        });
      }
      return this.res
        .status(200)
        .json(response(true, 'Daftar Potongan Berkala Berhasil Didapatkan', responses));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
}

module.exports = PeriodicPieces;

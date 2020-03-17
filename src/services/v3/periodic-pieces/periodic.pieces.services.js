require('module-alias/register');
const { periodic_pieces: PeriodicPieces } = require('@models');
const { response } = require('@helpers');

const periodicPieces = {
  delete: async (req, res) => {
    const { id } = req.params;
    try {
      const periodicPieces = await PeriodicPieces.destroy({ where: { id } });
      if (!periodicPieces) {
        return res.status(400).json(response(false, 'Gagal membatalkan potongan berkala'));
      }
      return res.status(200).json(response(true, 'Potongan berkala berhasil dibatalkan'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = periodicPieces;

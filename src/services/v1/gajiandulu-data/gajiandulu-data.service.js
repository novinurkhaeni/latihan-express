require('module-alias/register');
const { response } = require('@helpers');
const { gajiandulu_data: GajianDuluModel } = require('@models');

const gajianduluDataService = {
  get: async (req, res) => {
    try {
      const gajianduluData = await GajianDuluModel.findAll();

      if (!gajianduluData) {
        return res.status(400).json(response(false, `Gajiandulu data not available`));
      }
      return res
        .status(200)
        .json(response(true, 'Gajiandulu data has been successfully retrieved', gajianduluData));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = gajianduluDataService;

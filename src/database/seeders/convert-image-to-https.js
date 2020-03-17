'use strict';
require('module-alias/register');
const { digital_assets: DigitalAsset } = require('@models');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const digitalAssets = await DigitalAsset.findAll();
    for (let i = 0; i < digitalAssets.length; i++) {
      const newUrl = digitalAssets[i].url.replace('http', 'https');
      await queryInterface.bulkUpdate(
        'digital_assets',
        { url: newUrl },
        { id: digitalAssets[i].id }
      );
    }
    return;
  },

  down: async (queryInterface, Sequelize) => {
    const digitalAssets = await DigitalAsset.findAll({
      attributes: ['id', 'url']
    });

    for (let i = 0; i < digitalAssets.length; i++) {
      const newUrl = digitalAssets[i].url.replace('https', 'http');
      await queryInterface.bulkUpdate(
        'digital_assets',
        { url: newUrl },
        { id: digitalAssets[i].id }
      );
    }
    return;
  }
};

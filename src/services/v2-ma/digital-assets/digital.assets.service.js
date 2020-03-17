require('module-alias/register');
const { response } = require('@helpers');
const { digital_assets: DigitalAsset } = require('@models');
const path = require('path');
const config = require('config');
const fs = require('fs');

const digitalAssets = {
  post: async (req, res) => {
    const { type, uploadable_type, uploadable_id } = req.body;
    const host =
      process.env.NODE_ENV !== 'production'
        ? `http://${config.host}:${config.port}/`
        : `https://${config.host}/`;

    let filepath;
    let payloadDigital = {
      type,
      uploadable_type,
      uploadable_id
    };
    try {
      //   This will handle file as encoded base64 from client
      if (!req.file) {
        const base64Data = req.body.file.replace(/^data:image\/png;base64,/, '');
        const filename = Date.now() + '.png';
        filepath = path.join(__dirname + '/../../../public/uploads/' + filename);
        fs.writeFile(filepath, base64Data, 'base64', error => {
          if (error) {
            return new Error('Something went wrong when save your image! Please try again.');
          }
        });
        payloadDigital['filename'] = filename;
        payloadDigital['mime_type'] = 'image/png';
        payloadDigital['path'] = 'public/uploads/' + filename;
        payloadDigital['url'] = host + 'uploads/' + filename;
      }
      //   This will handle file as blob from client
      if (req.file) {
        filepath = req.file.path.split('/')[1];
        payloadDigital['path'] = req.file.path;
        payloadDigital['filename'] = req.file.filename;
        payloadDigital['mime_type'] = req.file.mimetype;
        payloadDigital['url'] = `${host}${filepath}/${req.file.filename}`;
      }
      const digitalAssets = await DigitalAsset.create(payloadDigital);
      if (!digitalAssets) return res.status(422).json(response(false, 'Gagal mengunggah gambar'));
      return res.status(201).json(response(true, 'Gambar berhasil diunggah'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};
module.exports = digitalAssets;

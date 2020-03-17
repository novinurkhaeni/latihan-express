require('module-alias/register');
const { response } = require('@helpers');
const {
  digital_assets: DigitalAsset,
  journal_details: JournalDetail,
  journals: Journal,
  users: User,
  employees: Employee
} = require('@models');
const config = require('config');
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const path = require('path');
const fs = require('fs');
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const digitalAssetService = {
  find: async (req, res) => {
    const { id: user_id } = res.local.users;
    try {
      const digitalAsset = await DigitalAsset.findAll({
        where: { user_id: user_id }
      });
      return res
        .status(200)
        .json(response(true, 'Digital assets retrieved successfully', digitalAsset, null));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  get: async (req, res) => {
    const { id: digitalAssetId } = req.params;
    try {
      const digitalAsset = await DigitalAsset.findOne({
        where: { id: digitalAssetId }
      });
      if (digitalAsset === null) {
        return res
          .status(200)
          .json(response(false, `DigitalAsset with id ${digitalAssetId} not found`));
      }
      return res
        .status(200)
        .json(response(true, 'Digital assets successfully', digitalAsset, null));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  // @TODO refactor later for better readybility
  create: async (req, res) => {
    const host =
      process.env.NODE_ENV !== 'production'
        ? `http://${config.host}:${config.port}/`
        : `https://${config.host}/`;

    let location;

    let payload = {
      type: req.body.type,
      uploadable_id: req.body.uploadable_id,
      uploadable_type: req.body.uploadable_type
    };

    // This will handle file as encoded base64 from client
    if (!req.file) {
      const base64Data = req.body.file.replace(/^data:image\/png;base64,/, '');
      const filename = Date.now() + '.png';

      location = path.join(__dirname + '/../../../public/uploads/' + filename);

      fs.writeFile(location, base64Data, 'base64', error => {
        if (error) {
          return new Error('Something went wrong when save your image!');
        }
      });
      payload['filename'] = filename;
      payload['mime_type'] = 'image/png';
      payload['path'] = 'public/uploads/' + filename;
      payload['url'] = host + 'uploads/' + filename;
    }

    // This will handle file as blob from client
    if (req.file) {
      location = req.file.path.split('/')[1];

      payload['path'] = req.file.path;
      payload['filename'] = req.file.filename;
      payload['mime_type'] = req.file.mimetype;
      payload['url'] = `${host}${location}/${req.file.filename}`;
    }

    let digitalAsset;

    try {
      if (req.body.type.toString() === 'avatar') {
        digitalAsset = await DigitalAsset.findOne({
          where: {
            [Op.and]: [
              { uploadable_type: req.body.uploadable_type },
              { uploadable_id: req.body.uploadable_id },
              { type: req.body.type }
            ]
          }
        });

        // Create new record if a user does not have the type of digital assets
        if (!digitalAsset) {
          digitalAsset = await DigitalAsset.create(payload);
        }

        // Update the record if type already exists
        if (digitalAsset) {
          digitalAsset = await DigitalAsset.update(payload, {
            where: {
              [Op.and]: [
                { uploadable_type: req.body.uploadable_type },
                { uploadable_id: req.body.uploadable_id },
                { type: req.body.type }
              ]
            }
          });

          // since update not returning the record we need to get the record
          digitalAsset = await DigitalAsset.findOne({
            where: {
              [Op.and]: [
                { uploadable_type: req.body.uploadable_type },
                { uploadable_id: req.body.uploadable_id },
                { type: req.body.type }
              ]
            }
          });
        }

        if (!digitalAsset) {
          return res
            .status(400)
            .json(response(true, `Sorry, digital assets type ${req.body.type} not created!`));
        }
      } else if (req.body.type.toString() === 'manual_presence') {
        const theDate = new Date();
        const today = `${theDate.getFullYear()}-${('0' + (theDate.getMonth() + 1)).slice(
          -2
        )}-${theDate.getDate()}`;

        digitalAsset = await DigitalAsset.count({
          where: {
            [Op.and]: [
              { uploadable_type: req.body.uploadable_type },
              { uploadable_id: req.body.uploadable_id },
              { type: req.body.type },
              Sequelize.where(
                Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
                today
              )
            ]
          }
        });

        if (digitalAsset > 10) {
          return res
            .status(400)
            .json(response(false, 'Batas upload presensi manual hari ini sudah mencapai 10'));
        }

        digitalAsset = await DigitalAsset.create(payload);
      }

      return res
        .status(201)
        .json(response(true, 'Digital assets created successfully', digitalAsset));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  remove: async (req, res) => {
    const { id: digitalAssetId } = req.body;
    try {
      const digitalAsset = await DigitalAsset.destroy({
        where: { id: digitalAssetId }
      });
      if (digitalAsset === 0) {
        return res
          .status(400)
          .json(response(false, `Digital assets with id ${digitalAssetId} not found`));
      }
      return null;
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  admin: async (req, res) => {
    const host =
      process.env.NODE_ENV !== 'production'
        ? `http://${config.host}:${config.port}/`
        : `https://${config.host}/`;

    let location;

    let payload = {
      type: req.body.type,
      uploadable_id: req.body.uploadable_id,
      uploadable_type: req.body.uploadable_type
    };

    // This will handle file as encoded base64 from client
    if (!req.file) {
      const base64Data = req.body.file.replace(/^data:image\/png;base64,/, '');
      const filename = Date.now() + '.png';

      location = path.join(__dirname + '/../../../public/uploads/' + filename);

      fs.writeFile(location, base64Data, 'base64', error => {
        if (error) {
          return new Error('Something went wrong when save your image!');
        }
      });
      payload['filename'] = filename;
      payload['mime_type'] = 'image/png';
      payload['path'] = 'public/uploads/' + filename;
      payload['url'] = host + 'uploads/' + filename;
    }

    // This will handle file as blob from client
    if (req.file) {
      location = req.file.path.split('/')[1];

      payload['path'] = req.file.path;
      payload['filename'] = req.file.filename;
      payload['mime_type'] = req.file.mimetype;
      payload['url'] = `${host}${location}/${req.file.filename}`;
    }
    let digitalAsset;
    try {
      const journal = await Journal.findOne({
        include: [
          { model: JournalDetail, where: { id: req.body.uploadable_id } },
          {
            model: Employee,
            include: { model: User },
            attributes: ['id', 'user_id']
          }
        ]
      });

      digitalAsset = await DigitalAsset.findOne({
        where: {
          [Op.and]: [
            { uploadable_type: req.body.uploadable_type },
            { uploadable_id: req.body.uploadable_id },
            { type: req.body.type }
          ]
        }
      });

      if (!digitalAsset) {
        await DigitalAsset.create(payload);
      }
      if (digitalAsset) {
        digitalAsset = await DigitalAsset.update(payload, {
          where: {
            [Op.and]: [
              { uploadable_type: req.body.uploadable_type },
              { uploadable_id: req.body.uploadable_id },
              { type: req.body.type }
            ]
          }
        });

        // since update not returning the record we need to get the record
        digitalAsset = await DigitalAsset.findOne({
          where: {
            [Op.and]: [
              { uploadable_type: req.body.uploadable_type },
              { uploadable_id: req.body.uploadable_id },
              { type: req.body.type }
            ]
          }
        });
      }

      await JournalDetail.update(
        {
          status: 1
        },
        { where: { id: req.body.uploadable_id } }
      );

      if (req.body.description && req.body.description !== '') {
        await Journal.update(
          {
            description: req.body.description
          },
          { where: { id: journal.id } }
        );
      }

      const withdrawDate = new Date(journal.journal_detail.created_at);

      //SEND EMAIL CONFIRMATION
      observe.emit(EVENT.WITHDRAW_APPROVED, {
        userId: journal.employee.user.id,
        userEmail: journal.employee.user.email,
        employeeId: journal.employee.id,
        withdrawId: journal.journal_detail.id,
        totalWithdraw: journal.journal_detail.total,
        withdrawDate: `${withdrawDate.getFullYear()}-${('0' + (withdrawDate.getMonth() + 1)).slice(
          -2
        )}-${('0' + withdrawDate.getDate()).slice(-2)}`
      });

      return res.status(201).json(response(true, 'Tarikan GajianDulu successfully approved'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  validatePresence: async (req, res) => {
    let digitalAsset;

    try {
      if (req.body.type.toString() === 'avatar') {
        return true;
      } else if (req.body.type.toString() === 'manual_presence') {
        const theDate = new Date();
        const today = `${theDate.getFullYear()}-${('0' + (theDate.getMonth() + 1)).slice(
          -2
        )}-${theDate.getDate()}`;

        digitalAsset = await DigitalAsset.count({
          where: {
            [Op.and]: [
              { uploadable_type: req.body.uploadable_type },
              { uploadable_id: req.body.uploadable_id },
              { type: req.body.type },
              Sequelize.where(
                Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
                today
              )
            ]
          }
        });
      } else {
        return 'type should be manual_presence or avatar';
      }

      if (digitalAsset >= 10) {
        return 'Batas upload presensi manual hari ini sudah mencapai 10';
      }

      return true;
    } catch (error) {
      if (error.errors) {
        return error.errors;
      }
      return error.message;
    }
  }
};

module.exports = digitalAssetService;

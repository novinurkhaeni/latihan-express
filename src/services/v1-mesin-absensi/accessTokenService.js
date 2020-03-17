require('module-alias/register');
const { jwtHelpers, response } = require('@helpers');
const {
  users: User,
  access_tokens: AccessToken,
  employees: Employee,
  companies: Company
} = require('@models');
const crypt = require('bcrypt');
const config = require('config');
const Sequelize = require('sequelize');
const { Op } = Sequelize;

const accessTokenService = {
  create: async (req, res) => {
    const { data } = req.body;
    const expires = 24 * 60 * 60;

    try {
      const user = await User.findOne({
        where: {
          [Op.or]: [{ email: data.email_phone }, { phone: data.email_phone }]
        },
        include: [
          {
            model: Employee,
            attributes: ['id', 'flag', 'role', 'active', 'company_id'],
            include: [{ model: Company, attributes: ['id', 'company_name'] }]
          }
        ]
      });

      if (user === null) {
        return res.status(400).json(response(false, 'User not found!'));
      }

      if (!user.registration_complete) {
        return res.status(400).json(response(false, 'Please complete your registration first!'));
      }

      if (user.employees[0].role === 2 || user.employees[0].role === 4) {
        return res
          .status(400)
          .json(
            response(
              false,
              'Hanya akun manager dan supervisor yang dapat digunakan untuk login ke Mesin Absensi'
            )
          );
      }

      let accessToken = await AccessToken.findOne({
        where: {
          user_id: user.id,
          client_id: 'mesin-absensi'
        }
      });

      if (crypt.compareSync(data.password, user.password)) {
        const token = jwtHelpers.createJWT(
          Object.assign({
            email: user.email,
            phone: user.phone,
            id: user.id,
            employeeId: user.employees[0].id,
            employeeRole: user.employees[0].role
          }),
          config.authentication.secret,
          expires
        );
        const tokenPayload = {
          access_token: token,
          refresh_token: jwtHelpers.refreshToken(),
          provider: data.provider,
          user_id: user.id,
          expiry_in: expires,
          client_id: 'mesin-absensi'
        };

        let createAccessToken;

        if (!accessToken) {
          createAccessToken = await AccessToken.create(tokenPayload);
        } else {
          createAccessToken = await AccessToken.update(tokenPayload, {
            where: {
              user_id: user.id,
              client_id: 'mesin-absensi'
            }
          });
        }

        if (!createAccessToken) {
          return res.status(400).json(response(false, 'Login failed'));
        }

        const payload = Object.assign({}, user.dataValues, tokenPayload);

        return res.status(200).json(response(true, 'Login successfully', payload));
      }

      return res.status(422).json(response(false, 'Username atau password salah'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  update: async (req, res) => {
    const { data } = req.body;
    const expires = 24 * 60 * 60;

    try {
      let accessToken = await AccessToken.findOne({
        where: { refresh_token: data.refresh_token, client_id: 'mesin-absensi' }
      });
      if (!accessToken) {
        return res
          .status(400)
          .json(response(false, 'invalid refresh token or access token not found'));
      }

      const user = await User.findOne({
        where: { id: accessToken.user_id },
        include: [
          {
            model: Employee,
            attributes: ['id', 'flag', 'role', 'company_id'],
            include: [{ model: Company, attributes: ['id'] }]
          }
        ]
      });

      const token = jwtHelpers.createJWT(
        Object.assign({
          email: user.email,
          phone: user.phone,
          id: user.id,
          employeeId: user.employees[0].id,
          employeeRole: user.employees[0].role
        }),
        config.authentication.secret,
        expires
      );
      const payload = {
        access_token: token,
        refresh_token: jwtHelpers.refreshToken(),
        expiry_in: expires
      };

      accessToken = await AccessToken.update(payload, {
        where: { refresh_token: data.refresh_token }
      });

      return res.status(200).json(response(true, 'Access token successfully updated', payload));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = accessTokenService;

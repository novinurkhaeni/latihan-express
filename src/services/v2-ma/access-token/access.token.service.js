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
    const expires = 365 * 24 * 60 * 60;

    try {
      const user = await User.findOne({
        attributes: ['id', 'full_name', 'email', 'phone', 'registration_complete', 'password'],
        where: {
          [Op.or]: [{ email: data.email_phone }, { phone: data.email_phone }]
        },
        include: [
          {
            model: Employee,
            attributes: ['id', 'flag', 'role', 'active', 'company_id'],
            include: [{ model: Company, attributes: ['id', 'company_name', 'parent_company_id'] }]
          }
        ]
      });

      if (user === null) {
        return res.status(400).json(response(false, 'Pengguna tidak ditemukan'));
      }

      if (!user.registration_complete) {
        return res.status(400).json(response(false, 'Silahkan selesaikan proses regitrasi anda'));
      }

      if (user.employees[0].role !== 1) {
        return res
          .status(400)
          .json(
            response(false, 'Hanya akun pemilik yang dapat digunakan untuk login ke Mesin Absensi')
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

        const payload = {
          id: user.id,
          employee_id: user.employees[0].id,
          company_id: user.employees[0].company_id,
          parent_company_id: user.employees[0].company.parent_company_id,
          flag: user.employees[0].flag,
          role: user.employees[0].role,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          registration_complete: user.registration_complete,
          access_token: tokenPayload.access_token,
          refresh_token: tokenPayload.refresh_token,
          expiry_in: tokenPayload.expiry_in
        };
        return res.status(200).json(response(true, 'Login successfully', payload));
      }

      return res.status(422).json(response(false, 'Username atau password salah'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = accessTokenService;

require('module-alias/register');
const {
  users: User,
  employees: Employee,
  pins: Pin,
  access_tokens: AccessToken,
  companies: Company,
  abilities: Ability
} = require('@models');
const { jwtHelpers, response, abilityFinder } = require('@helpers');
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const config = require('config');

const loginService = {
  check: async (req, res) => {
    const { data } = req.body;
    try {
      if (req.body.data.email_phone) {
        const user = await User.findOne({
          where: { [Op.or]: [{ email: data.email_phone }, { phone: data.email_phone }] },
          attributes: ['id']
        });

        if (user === null) {
          return res.status(400).json(response(false, 'Pengguna tidak ditemukan!'));
        }

        const responses = { user_id: user.id };

        return res.status(200).json(response(true, 'Pengguna ditemukan!', responses));
      } else {
        const expires = 365 * 24 * 60 * 60;
        const pin = await Pin.findOne({
          where: { pin: data.pin, user_id: data.user_id }
        });
        if (!pin) {
          return res.status(400).json(response(false, 'Pin salah!'));
        }

        const user = await User.findOne({
          where: { id: data.user_id },
          include: [
            {
              model: Employee,
              order: [[Sequelize.col('employees.id'), 'desc']],
              include: [
                { model: Company, attributes: ['id', 'parent_company_id'] },
                { model: Ability }
              ],
              separate: true,
              limit: 1
            },
            { model: Pin, required: false }
          ]
        });

        if (!user.registration_complete) {
          return res.status(400).json(response(false, 'Lengkapi pendaftaran anda!'));
        }

        await User.update(
          { login_attempt: user.login_attempt + 1 },
          { where: { id: data.user_id } }
        );

        const token = jwtHelpers.createJWT(
          Object.assign({
            email: user.email,
            phone: user.phone,
            id: user.id,
            employeeId: user.employees.length ? user.employees[0].id : null,
            employeeRole: user.employees.length ? user.employees[0].role : null,
            companyParentId: user.employees.length
              ? user.employees[0].company.parent_company_id
              : null
          }),
          config.authentication.secret,
          expires
        );
        const payload = {
          access_token: token,
          refresh_token: jwtHelpers.refreshToken(),
          user_id: data.user_id,
          expiry_in: expires,
          client_id: 'app'
        };

        let accessToken = await AccessToken.findOne({
          where: {
            user_id: data.user_id,
            [Op.or]: [{ client_id: null }, { client_id: 'app' }]
          }
        });

        if (!accessToken) {
          await AccessToken.create(payload);
        } else {
          await AccessToken.update(payload, {
            where: {
              user_id: data.user_id,
              [Op.or]: [{ client_id: null }, { client_id: 'app' }]
            }
          });
        }

        accessToken = await AccessToken.findOne({
          where: {
            user_id: data.user_id,
            [Op.or]: [{ client_id: null }, { client_id: 'app' }]
          },
          include: [{ model: User, as: 'user' }]
        });

        if (!accessToken) {
          return res.status(400).json(response(false, 'Login gagal!'));
        }

        accessToken = Object.assign({}, accessToken.dataValues, {
          company_id: user.employees.length ? user.employees[0].company.id : null,
          employee_id: user.employees.length ? user.employees[0].id : null,
          flag: user.employees.length ? user.employees[0].flag : null,
          role: user.employees.length ? user.employees[0].role : null,
          active: user.employees.length ? user.employees[0].active : null,
          pin: user.pin.pin,
          pin_id: user.pin.id,
          ability: user.employees.length ? await abilityFinder(user.employees[0]) : null
        });
        return res.status(200).json(response(true, 'Login berhasil!', accessToken));
      }
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }

      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = loginService;

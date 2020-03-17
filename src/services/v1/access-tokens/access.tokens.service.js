require('module-alias/register');
const { jwtHelpers, response, abilityFinder } = require('@helpers');
const {
  users: User,
  access_tokens: AccessToken,
  bca_access_tokens: BcaAccessToken,
  employees: Employee,
  companies: Company,
  abilities: Abilities,
  pins: Pins,
  salary_groups: SalaryGroups
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
      let showWelcoming = false;
      let welcomeMode = 1;

      const employee = await Employee.findOne({
        order: [['id', 'desc']],
        include: [
          { model: Company, attributes: ['id', 'parent_company_id'] },
          { model: Abilities },
          {
            model: User,
            where: {
              [Op.or]: [{ email: data.email_phone }, { phone: data.email_phone }]
            },
            include: {
              model: Pins,
              required: false
            }
          }
        ]
      });
      if (employee === null) {
        return res.status(400).json(response(false, 'User not found!'));
      }

      if (!employee.user.registration_complete) {
        return res.status(400).json(response(false, 'Please complete your registration first!'));
      }

      const findSalaryGroups = await SalaryGroups.findAll({
        where: { company_id: employee.company.id }
      });
      if (findSalaryGroups.length) {
        await User.update(
          { login_attempt: employee.user.login_attempt + 1 },
          { where: { id: employee.user.id } }
        );
      }
      if (!findSalaryGroups.length && employee.user.created_at <= '2019-03-30 00:00:00') {
        showWelcoming = true;
        welcomeMode = 1;
      }
      if (
        findSalaryGroups.length &&
        employee.user.created_at <= '2019-03-30 00:00:00' &&
        employee.user.login_attempt < 3
      ) {
        showWelcoming = true;
        welcomeMode = 2;
      }

      // @TODO Uncomment this when email service activated
      // if (!user.is_confirmed_email) {
      //   return res
      //     .status(400)
      //     .json(response(false, 'We sent you an email confirmation, please do confirm your email first!'));
      // }

      let accessToken = await AccessToken.findOne({
        where: {
          user_id: employee.user.id,
          [Op.or]: [{ client_id: null }, { client_id: 'app' }]
        }
      });

      if (crypt.compareSync(data.password, employee.user.password)) {
        const token = jwtHelpers.createJWT(
          Object.assign({
            email: employee.user.email,
            phone: employee.user.phone,
            id: employee.user.id,
            employeeId: employee.id,
            employeeRole: employee.role,
            companyParentId: employee.company.parent_company_id
          }),
          config.authentication.secret,
          expires
        );
        const payload = {
          access_token: token,
          refresh_token: jwtHelpers.refreshToken(),
          provider: data.provider,
          user_id: employee.user.id,
          expiry_in: expires,
          client_id: 'app'
        };

        if (!accessToken) {
          await AccessToken.create(payload);
        } else {
          await AccessToken.update(payload, {
            where: {
              user_id: employee.user.id,
              [Op.or]: [{ client_id: null }, { client_id: 'app' }]
            }
          });
        }

        accessToken = await AccessToken.findOne({
          where: {
            user_id: employee.user.id,
            [Op.or]: [{ client_id: null }, { client_id: 'app' }]
          },
          include: [{ model: User, as: 'user' }]
        });
        accessToken = Object.assign({}, accessToken.dataValues, {
          company_id: employee.company.id,
          employee_id: employee.id,
          flag: employee.flag,
          role: employee.role,
          active: employee.active,
          ability: await abilityFinder(employee),
          pin: employee.user.pin,
          show_welcoming: showWelcoming,
          welcome_mode: welcomeMode
        });

        if (!accessToken) {
          return res.status(400).json(response(false, 'Login failed'));
        }

        return res
          .status(200)
          .json(
            response(
              true,
              'Login successfully',
              accessToken.length > 0 ? accessToken[0] : accessToken,
              null
            )
          );
      }

      return res.status(422).json(response(false, 'Username atau password salah'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  createBca: async (req, res) => {
    const { grant_type } = req.body;
    const { authorization } = req.headers;
    const expires = 60 * 60;
    try {
      if (!authorization) {
        return res.status(403).json(response(false, 'Authorization header is not present'));
      }
      let encodedBase64 = Buffer.from(authorization.split(' ')[1], 'base64').toString('ascii');
      encodedBase64 = encodedBase64.split(':');
      if (
        encodedBase64[0] !== '75300e92-ad24-4180-ab16-ab7ac9026905' ||
        encodedBase64[1] !== 'd9571547-00f1-49e5-a87e-9db86280fe01'
      ) {
        return res.status(403).json(response(false, 'Not allowed'));
      }

      if (grant_type !== 'client_credentials') {
        return res.status(403).json(response(false, 'Wrong grant_type'));
      }

      const token = jwtHelpers.createJWT(
        Object.assign({
          client_id: encodedBase64[0]
        }),
        config.authentication.secret,
        expires
      );
      const payload = {
        access_token: token,
        expiry_in: expires
      };

      const createToken = await BcaAccessToken.create(payload);
      if (!createToken) {
        return res.status(403).json(response(false, 'Login failed'));
      }

      delete payload.expiry_in;

      const responses = {
        ...payload,
        expires_in: expires,
        token_type: 'Bearer',
        scope: 'resource.WRITE resource.READ'
      };

      return res.status(200).json(responses);
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  update: async (req, res) => {
    const { data } = req.body;
    const expires = 365 * 24 * 60 * 60;

    try {
      let accessToken = await AccessToken.findOne({
        where: { refresh_token: data.refresh_token }
      });
      if (!accessToken) {
        return res
          .status(400)
          .json(response(false, 'invalid refresh token or access token not found'));
      }

      const employee = await Employee.findOne({
        where: { active: 1 },
        order: [['id', 'desc']],
        include: [
          { model: User, where: { id: accessToken.user_id } },
          { model: Company, attributes: ['id', 'parent_company_id'] },
          { model: Abilities }
        ]
      });

      const token = jwtHelpers.createJWT(
        Object.assign({
          email: employee.user.email,
          phone: employee.user.phone,
          id: employee.user.id,
          employeeId: employee.id,
          employeeRole: employee.role,
          companyParentId: employee.company.parent_company_id
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
      accessToken = await AccessToken.findOne({
        where: { user_id: employee.user.id },
        include: [{ model: User, as: 'user' }]
      });

      accessToken = Object.assign({}, accessToken.dataValues, {
        company_id: employee.company.id,
        employee_id: employee.id,
        flag: employee.flag,
        role: employee.role,
        ability: await abilityFinder(employee)
      });

      return res.status(200).json(response(true, 'Access token successfully updated', accessToken));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = accessTokenService;

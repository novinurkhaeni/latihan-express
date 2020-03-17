require('module-alias/register');
const { response, jwtHelpers } = require('@helpers');
const { users: User, access_tokens: AccessToken, employees: Employee } = require('@models');
const axios = require('axios');
const crypt = require('bcrypt');
const config = require('config');
const Sequelize = require('sequelize');
const { Op } = Sequelize;

const userService = {
  find: async (req, res) => {
    try {
      const user = await User.all();
      return res.status(200).json(response(true, 'User retrieved successfully', user, null));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  get: async (req, res) => {
    const userId = req.params.id;
    try {
      const user = await User.findOne({ where: { id: userId } });
      if (user === null) {
        return res.status(400).json(response(false, `User with id ${userId} not found`));
      }
      return res.status(200).json(response(true, 'User retrieved successfully', user, null));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  /**
   * create user to database
   *
   */
  create: async (req, res) => {
    const { password, email, full_name, birthday, phone } = req.body;
    let user;

    try {
      user = await User.findOne({
        where: { $or: { email: email, phone: phone } },
        include: { model: Employee, required: false }
      });
      if (user) {
        if (user.employees.length > 0) {
          if (user.employees[0].flag.toString() === '1' && user.phone !== phone) {
            return res
              .status(400)
              .json(response(false, 'Nomor ponsel tidak sesuai dengan undangan manager'));
          }
          if (user.employees[0].flag.toString() === '1' && user.email !== email) {
            return res
              .status(400)
              .json(response(false, 'Alamat email tidak sesuai dengan undangan manager'));
          }
        }

        if (!user.registration_complete) {
          // second parameter is salt for hash
          const hashPassword = crypt.hashSync(password, 15);
          const hash = crypt.hashSync(new Date().toString() + email, 10);
          const payload = Object.assign(
            {},
            {
              full_name,
              email,
              birthday,
              password: hashPassword,
              hash
            }
          );
          await User.update(payload, {
            where: { $or: { email: email, phone: phone } }
          });
          user = await User.findOne({
            where: { $or: { email: email, phone: phone } }
          });
          return res
            .status(200)
            .json(response(true, 'Invited user has been registered successfully', user));
        } else {
          return res
            .status(422)
            .json(
              response(
                false,
                'Akun sudah terdaftar. Mohon coba lagi dengan email dan nomor ponsel lain.'
              )
            );
        }
      } else {
        // second parameter is salt for hash
        const hashPassword = crypt.hashSync(password, 15);
        const hash = crypt.hashSync(new Date().toString() + email, 10);
        const payload = Object.assign(
          {},
          {
            full_name,
            email,
            birthday,
            password: hashPassword,
            hash
          }
        );
        user = await User.create(payload);
        return res.status(201).json(response(true, 'User has been registered successfully', user));
      }
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  /**
   * Check authorization_code from account kit client
   * if the authorization_code valid facebook graph should return
   * access token and then update phone number to user data
   *
   */
  put: async (req, res) => {
    const { data } = req.body;
    const expires = 60 * 60;

    const { hash } = data;
    try {
      let user = await User.findOne({ where: { hash } });
      if (!user) {
        return res.status(400).json(response(false, 'User not found'));
      }

      // Check authorization code to facebook graph server
      const { clientID, clientSecret, graphUri } = config.authentication.facebook;

      const fbAccessToken = await axios.get(
        `${graphUri}/access_token?grant_type=authorization_code&code=${data.authorization_code}&access_token=AA|${clientID}|${clientSecret}`
      );

      if (!fbAccessToken || fbAccessToken.error) {
        return res.status(512).json(response(false, fbAccessToken.error));
      }

      const fbDataKit = await axios.get(
        `${graphUri}/me/?access_token=${fbAccessToken.data.access_token}`
      );

      if (!fbDataKit || fbDataKit.error) {
        return res.status(512).json(response(false, fbDataKit.error));
      }

      const validatePhone = await User.findOne({
        where: {
          [Op.and]: [
            { phone: `0${fbDataKit.data.phone.national_number}` },
            { registration_complete: 1 }
          ]
        }
      });
      if (validatePhone) {
        return res
          .status(400)
          .json(response(false, 'Nomor telepon sudah terdaftar. Mohon coba nomor lain.'));
      }

      const token = jwtHelpers.createJWT(
        Object.assign({
          email: user.email,
          id: user.id,
          full_name: user.full_name
        }),
        config.authentication.secret,
        expires
      );
      const payload = {
        access_token: token,
        refresh_token: jwtHelpers.refreshToken(),
        provider: 'account-kit',
        user_id: user.id,
        expiry_in: expires
      };
      let accessToken = await AccessToken.findOne({
        where: { user_id: user.id }
      });
      if (!accessToken) {
        await AccessToken.create(payload);
      } else {
        await AccessToken.update(payload, {
          where: { user_id: user.id }
        });
      }
      user = await User.update(
        {
          phone: `0${fbDataKit.data.phone.national_number}`,
          is_phone_confirmed: 1
        },
        { where: { hash } }
      );
      user = await User.findOne({ where: { hash } });
      accessToken = await AccessToken.findOne({
        where: { user_id: user.id }
      });

      const dataResponse = Object.assign({}, accessToken.dataValues, {
        phone: user.phone
      });

      if (accessToken) {
        return res
          .status(200)
          .json(response(true, 'Phone number validation success', dataResponse));
      }
      return res.status(422).json(response(false, 'Unprocessable entity'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  remove: async (req, res) => {
    const userId = req.params.id;
    try {
      const user = await User.destroy({ where: { id: userId } });
      if (user === 0) {
        return res.status(400).json(response(false, `User with id ${userId} not found`));
      }
      return null;
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  patchDemo: async (req, res) => {
    const { users } = res.local;
    const { data } = req.body;
    try {
      const updateDemo = await User.update(data, { where: { id: users.id } });
      if (!updateDemo) {
        return res.status(400).json(response(false, 'gagal update user demo'));
      }
      return res.status(200).json(response(true, 'berhasil update user demo'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  getDemo: async (req, res) => {
    const { users } = res.local;
    try {
      const user = await User.findOne({ where: { id: users.id } });
      if (!user) {
        res.status(400).json(response(false, 'tidak berhasil menemukan user'));
      }
      const payload = Object.assign({
        demo_mode: user.demo_mode,
        demo_step: user.demo_step
      });
      return res.status(200).json(response(true, 'berhasil mendapatkan user demo', payload));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = userService;

require('module-alias/register');
const { jwtHelpers, response } = require('@helpers');
const { admins: Admin, admin_access_tokens: AdminAccessToken } = require('@models');
const crypt = require('bcrypt');
const config = require('config');

const adminAccessTokenService = {
  create: async (req, res) => {
    const { data } = req.body;
    const expires = 24 * 60 * 60;

    try {
      const adminData = await Admin.findOne({
        where: {
          email: data.email
        },
        exclude: ['created_at', 'updated_at']
      });

      if (!adminData) {
        return res.status(400).json(response(false, 'Admin not found!'));
      }

      if (adminData.active.toString() === '0') {
        return res.status(403).json(response(false, 'Your account is suspended!'));
      }

      let accessToken = await AdminAccessToken.findOne({
        where: {
          admin_id: adminData.id
        }
      });

      if (crypt.compareSync(data.password, adminData.password)) {
        const token = jwtHelpers.createJWT(
          Object.assign({
            id: adminData.id,
            full_name: adminData.full_name,
            email: adminData.email,
            roles: adminData.roles
          }),
          config.authentication.secret,
          expires
        );

        const payload = {
          admin_id: adminData.id,
          access_token: token,
          refresh_token: jwtHelpers.refreshToken(),
          expiry_in: expires,
          user_agent: data.user_agent,
          provider: `${data.provider}/${req.ip}`
        };

        if (!accessToken) {
          await AdminAccessToken.create(payload);
        } else {
          await AdminAccessToken.update(payload, {
            where: {
              admin_id: adminData.id
            }
          });
        }

        accessToken = await AdminAccessToken.findOne({
          where: {
            admin_id: adminData.id
          },
          include: [{ model: Admin, as: 'admin' }]
        });

        if (!accessToken) {
          return res.status(400).json(response(false, 'Login failed'));
        }

        return res.status(200).json(response(true, 'Login successfully', accessToken));
      }

      return res.status(422).json(response(false, 'Password mismatch'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = adminAccessTokenService;

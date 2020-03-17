require('module-alias/register');
const { Sequelize } = require('sequelize');
const { Op } = Sequelize;
const { response } = require('@helpers');
const { users: User } = require('@models');
const crypt = require('bcrypt');

const forgotPasswordService = {
  /*
   * this method bellow used to create new password when user forgot their password
   * user must send authorization_code (from account kit) and new password
   */

  create: async (req, res) => {
    const { data } = req.body;
    try {
      // 2. Check number in user db and update if exist
      const user = await User.findOne({
        where: { phone: { [Op.like]: `%${data.phone}` }, registration_complete: 1 }
      });

      if (!user) {
        return res.status(422).json(response(false, 'User tidak ditemukan'));
      }

      const hashPassword = crypt.hashSync(data.new_password, 15);
      await user.update({ password: hashPassword });

      // 3. return response
      return res.status(200).json(response(true, 'password was successfully changed'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  verify: async (req, res) => {
    const { phone } = req.query;
    try {
      const user = await User.findOne({
        where: { phone: { [Op.like]: `%${phone}` }, registration_complete: 1 }
      });
      if (!user) {
        return res.status(400).json(response(false, 'User tidak ditemukan'));
      }
      return res.status(200).json(response(true, 'User ditemukan', { phone: user.phone }));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = forgotPasswordService;

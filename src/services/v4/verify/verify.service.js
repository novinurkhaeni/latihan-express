require('module-alias/register');

const { decrypt } = require('@helpers');
const { users: User } = require('@models');

const verifyService = {
  verify: async (req, res) => {
    const { code } = req.query;
    try {
      const userId = decrypt(code);
      const updateUser = await User.update({ is_email_confirmed: 1 }, { where: { id: userId } });
      if (!updateUser) {
        return res.end('Terjadi kesalahan saat memverifikasi email anda');
      }
      return res.end('Email anda berhasil diverifikasi');
    } catch (error) {
      return res.end('Terjadi kesalahan saat memverifikasi email anda');
    }
  }
};

module.exports = verifyService;

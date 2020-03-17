require('module-alias/register');
const { response } = require('@helpers');
const { notifications: Notification } = require('@models');

const notification = {
  patch: async (req, res) => {
    const { employee_id } = req.params;
    const { data } = req.body;
    try {
      const updateNotif = await Notification.update(
        { is_read: data.is_read },
        { where: { employee_id } }
      );
      if (!updateNotif) {
        return res.status(400).json(response(false, 'Gagal mengubah notifikasi'));
      }
      return res.status(200).json(response(true, 'Notifikasi berhasil diubah'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = notification;

require('module-alias/register');
const { response } = require('@helpers');
const { employees: EmployeeModel, pins: PinModel } = require('@models');

const pinService = {
  create: async (req, res) => {
    const { data } = req.body;
    try {
      const employee = await EmployeeModel.findOne({ where: { id: data.employee_id } });
      if (!employee) {
        return res.status(400).json(response(false, 'Member tidak ditemukan'));
      }
      const checkPin = await PinModel.findOne({ where: { employee_id: data.employee_id } });
      if (checkPin) {
        const updatePin = await PinModel.update({ pin: data.pin }, { where: { id: checkPin.id } });
        if (!updatePin) {
          return res.status(400).json(response(false, 'Gagal membuat pin'));
        }
      } else {
        const createPin = await PinModel.create(data);
        if (!createPin) {
          return res.status(400).json(response(false, 'Gagal membuat pin'));
        }
      }
      return res.status(200).json(response(true, 'Pin berhasil dibuat'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  edit: async (req, res) => {
    const { data } = req.body;
    const { id } = req.params;
    const { employeeId } = res.local.users;
    try {
      const employee = await EmployeeModel.findOne({ where: { id: employeeId } });
      if (!employee) {
        return res.status(400).json(response(false, 'Member tidak ditemukan'));
      }
      let pin = await PinModel.update(data, { where: { id } });
      if (!pin) {
        return res.status(400).json(response(false, 'Pin gagal diubah'));
      }
      pin = await PinModel.findOne({ where: { id } });
      return res.status(200).json(response(true, 'Pin berhasil diubah', pin));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  delete: async (req, res) => {
    const { pin_id } = req.params;
    try {
      const pin = await PinModel.findOne({ where: { id: pin_id } });
      if (!pin) {
        return res.status(400).json(response(false, 'Pin tidak ditemukan'));
      }
      await PinModel.destroy({ where: { id: pin_id } });
      return res.status(200).json(response(true, 'Pin berhasil dihapus'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = pinService;

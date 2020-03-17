require('module-alias/register');
const { response } = require('@helpers');
const { pins: Pin, employees: Employee, users: User } = require('@models');

const pin = {
  verify: async (req, res) => {
    const { data } = req.body;
    try {
      const employee = await Employee.findOne({
        attributes: ['id'],
        where: { id: data.employee_id },
        include: { model: User, attributes: ['id'] }
      });
      if (!employee) {
        return res.status(400).json(response(false, 'Anggota tidak ditemukan'));
      }
      const pin = await Pin.findOne({
        attributes: ['pin'],
        where: { user_id: employee.user.id }
      });
      if (!pin) {
        return res.status(400).json(response(false, 'Anda tidak memiliki pin'));
      }
      if (pin.pin != data.pin) {
        return res.status(400).json(response(false, 'Pin salah'));
      }
      return res.status(200).json(response(true, 'Pin benar'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = pin;

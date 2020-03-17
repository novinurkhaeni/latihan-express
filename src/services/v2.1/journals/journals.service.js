require('module-alias/register');
const { response } = require('@helpers');
const {
  journals: Journal,
  employee_notes: EmployeeNotes,
  users: User,
  employees: Employee
} = require('@models');
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const journalService = {
  post: async (req, res) => {
    const { employee_id } = req.params;
    const { data } = req.body;
    const { id, employeeId } = res.local.users;
    try {
      const employee = await Employee.findOne({
        where: { id: employee_id },
        include: { model: User, attributes: ['full_name'] }
      });
      if (!employee) {
        return res.status(400).json(response(false, `Anggota tidak ditemukan`));
      }
      const date = data.created_at.split(' ')[0];
      const type = data.mode === 'bonus' ? 1 : 2;
      const typeName = data.mode === 'bonus' ? 'bonus' : 'potongan';
      if (data.debet || data.kredit) {
        const payload = Object.assign({}, data, { employee_id });
        const journals = await Journal.create(payload);
        if (!journals) {
          return res.status(400).json(response(false, `Journal data not created`));
        }
      }
      // CREATE NOTE
      const payload = {
        employee_id,
        type,
        date,
        notes: data.notes,
        amount: data.debet || data.kredit
      };
      await EmployeeNotes.create(payload);
      // SEND ACTIVITY NOTIFICATION
      const checkUser = await User.findOne({ where: { id } });
      const description = `${checkUser.full_name} telah menambah/mengurangi ${typeName} untuk anggota ${employee.user.full_name}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      return res.status(201).json(response(true, 'Journal data has been successfully created'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = journalService;

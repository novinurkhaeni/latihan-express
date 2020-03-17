require('module-alias/register');
const { response } = require('@helpers');
const { employee_notes: EmployeeNote, users: User, employees: Employee } = require('@models');
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const noteService = {
  create: async (req, res) => {
    const { employee_id } = req.params;
    const { data } = req.body;
    const { id, employeeId } = res.local.users;
    try {
      let employeeNotes;
      let payload;
      const employee = await Employee.findOne({
        where: { id: employee_id },
        include: { model: User, attributes: ['full_name'] }
      });
      if (!employee) {
        return res.status(400).json(response(false, `Anggota tidak ditemukan`));
      }

      if (data.note_id) {
        const noteId = data.note_id;
        payload = Object.assign({}, data, delete data.note_id, { employee_id });
        employeeNotes = await EmployeeNote.update(payload, {
          where: { id: noteId }
        });
      } else {
        employeeNotes = await EmployeeNote.findOne({
          where: { date: data.date, employee_id, type: null }
        });
        if (employeeNotes) {
          return res
            .status(400)
            .json(response(false, 'Create note cannot be more than one, please specify note_id'));
        }
        payload = Object.assign({}, data, { employee_id });
        employeeNotes = await EmployeeNote.create(payload);
      }

      if (!employeeNotes) {
        return res.status(400).json(response(false, `Employee note data not created`));
      }
      // SEND ACTIVITY NOTIFICATION
      const checkUser = await User.findOne({ where: { id } });
      const description = `${checkUser.full_name} telah menambah/mengubah catatan untuk anggota ${employee.user.full_name}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      return res.status(201).json(response(true, 'Catatan berhasil ditambahkan'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = noteService;

require('module-alias/register');
const {
  users: User,
  salary_groups: SalaryGroup,
  schedule_shift_details: ScheduleShiftDetail,
  schedule_shifts: ScheduleShift,
  salary_details: SalaryDetail
} = require('@models');
const { response } = require('@helpers');

const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const salaryGroups = {
  delete: async (req, res) => {
    const { salary_group_id: salaryGroupId } = req.params;
    const { id, employeeId } = res.local.users;
    try {
      const checkUser = await User.findOne({ where: { id } });
      const salaryGroup = await SalaryGroup.findOne({
        where: { id: salaryGroupId },
        include: { model: ScheduleShift, required: false, include: { model: ScheduleShiftDetail } }
      });
      if (!salaryGroup) {
        return res.status(400).json(response(false, 'Golongan gaji tidak ditemukan'));
      }
      if (salaryGroup.schedule_shift && salaryGroup.schedule_shift.schedule_shift_details.length) {
        return res.status(400).json(response(false, 'Golongan gaji sedang digunakan di jadwal'));
      }

      // Check is Salary Group is Used by Member
      const memberSalaryGroup = await SalaryDetail.findOne({ where: { salary_id: salaryGroupId } });
      if (memberSalaryGroup) {
        return res.status(400).json(response(false, 'Golongan gaji sedang digunakan oleh member'));
      }

      const deleteSalaryGroup = await SalaryGroup.destroy({ where: { id: salaryGroupId } });
      if (!deleteSalaryGroup) {
        return res.status(400).json(response(false, 'Golongan gaji gagal dihapus'));
      }
      // SEND NOTIFICATION TO MANAGERS
      const description = `${checkUser.full_name} telah menghapus golongan gaji dengan nama ${salaryGroup.salary_name}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      return res.status(200).json(response(true, 'Golongan gaji berhasil dihapus'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = salaryGroups;

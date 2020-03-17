require('module-alias/register');
const { response } = require('@helpers');
const {
  companies: CompanyModel,
  schedule_shifts: ScheduleShift,
  users: User,
  schedule_shift_details: ScheduleShiftDetail
} = require('@models');

const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const shiftService = {
  getDetail: async (req, res) => {
    const { shift_id: shiftId } = req.params;
    try {
      const shiftDetail = await ScheduleShift.findOne({
        where: { id: shiftId },
        include: { model: CompanyModel, attributes: ['id', 'name', 'company_name'] }
      });
      if (!shiftDetail) {
        return res.status(400).json(response(false, 'ID shift tidak tersedia'));
      }
      return res.status(200).json(response(true, 'Berhasil memuat data waktu kerja', shiftDetail));
    } catch (error) {
      return res.status(400).json(response(false, error.errors));
    }
  },
  editShift: async (req, res) => {
    const { shift_id: shiftId } = req.params;
    const { id, employeeId } = res.local.users;
    const { data } = req.body;
    try {
      const shiftDetail = await ScheduleShift.findOne({ where: { id: shiftId } });
      if (!shiftDetail) {
        return res.status(400).json(response(false, 'ID shift tidak tersedia'));
      }
      const editShift = await ScheduleShift.update(data, { where: { id: shiftId } });
      if (!editShift) {
        return res.status(400).json(response(false, 'Gagal mengedit shift'));
      }
      // SEND NOTIFICATION TO MANAGERS
      const checkUser = await User.findOne({ where: { id } });
      const description = `${checkUser.full_name} telah mengubah waktu kerja dengan nama ${shiftDetail.shift_name}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      return res.status(201).json(response(true, 'Berhasil mengedit shift'));
    } catch (error) {
      return res.status(400).json(response(false, error.errors));
    }
  },
  deleteShift: async (req, res) => {
    const { shift_id: shiftId } = req.params;
    const { id, employeeId } = res.local.users;
    try {
      const shiftDetail = await ScheduleShift.findOne({ where: { id: shiftId, is_deleted: 0 } });
      if (!shiftDetail) {
        return res.status(400).json(response(false, 'Shift tidak tersedia atau sudah dihapus'));
      }
      // Check is Shift Already Used in Schedule
      const scheduleShift = await ScheduleShiftDetail.findOne({ where: { shift_id: shiftId } });
      if (scheduleShift) {
        return res.status(400).json(response(false, 'Shift sedang digunakan di jadwal'));
      }

      const deleteSchedule = await ScheduleShift.update(
        { is_deleted: 1 },
        { where: { id: shiftId } }
      );
      if (!deleteSchedule) {
        return res.status(400).json(response(false, 'Gagal menghapus shift'));
      }
      // SEND NOTIFICATION TO MANAGERS
      const checkUser = await User.findOne({ where: { id } });
      const description = `${checkUser.full_name} telah menghapus waktu kerja dengan nama ${shiftDetail.shift_name}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      return res.status(200).json(response(true, 'Berhasil menghapus waktu kerja'));
    } catch (error) {
      return res.status(400).json(response(false, error.errors));
    }
  }
};

module.exports = shiftService;

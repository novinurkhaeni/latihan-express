/* eslint-disable indent */
require('module-alias/register');
const { response, getAddress } = require('@helpers');
const {
  presences: PresenceModel,
  defined_schedules: DefinedSchedulesModel,
  schedule_templates: ScheduleTemplate,
  schedule_shift_details: ScheduleShiftDetailModel,
  schedule_shifts: ScheduleShift,
  schedule_notes: ScheduleNotesModel,
  employees: EmployeesModel,
  employee_notes: EmployeeNotesModel,
  companies: CompanyModel,
  users: UserModel,
  digital_assets: DigitalAssetsModel
} = require('@models');

// eslint-disable-next-line prettier/prettier
const isNoteNull = notes => {
  return !notes ? 'no note data' : notes;
};
const coordinateToAddress = async qr => {
  const coord = {
    checkin_location: qr.checkin_location,
    checkout_location: qr.checkout_location,
    rest_begin_location: qr.rest_begin_location,
    rest_end_location: qr.rest_end_location
  };
  return await getAddress(coord);
};

/** Object to hold formatting response requested */
const formatPresence = async (qr, assets) => {
  const locationAddress = await coordinateToAddress(qr);

  return {
    id: qr.id,
    is_custom_ceklog: qr.is_custom_presence,
    is_absence: qr.is_absence,
    is_leave: qr.is_leave,
    is_permit: qr.is_permit,
    note: isNoteNull(qr.employee.employee_notes[0]),
    presence_start: {
      time: qr.presence_start,
      location: locationAddress.checkin_location,
      image: assets.url,
      presence_overdue: qr.presence_overdue
    },
    rest_start: {
      time: qr.rest_start,
      location: locationAddress.rest_begin_location,
      image: assets.url
    },
    rest_end: {
      time: qr.rest_end,
      location: locationAddress.rest_end_location,
      image: assets.url,
      rest_overdue: qr.rest_overdue
    },
    presence_end: {
      time: qr.rest_end,
      location: locationAddress.checkout_location,
      image: assets.url,
      home_early: qr.home_early,
      overwork: qr.overwork
    }
  };
};

const queryPresences = async ID => {
  try {
    let result = await PresenceModel.findOne({
      where: { id: ID },
      include: [
        { model: CompanyModel, attributes: ['id', 'codename', 'address', 'location'] },
        {
          model: EmployeesModel,
          attributes: ['id'],
          include: [
            { model: EmployeeNotesModel, where: { type: null }, attributes: ['id', 'notes'] }
          ]
        }
      ]
    });

    // Retrieve image location asset
    let assets = await DigitalAssetsModel.findAll({
      attributes: ['id', 'type', 'url'],
      where: { uploadable_type: 'presences', uploadable_id: result.id }
    });

    if (!result) throw new Error(`Failed to query: presence id ${ID} does not exist`);

    return await formatPresence(result, assets[0]);
  } catch (error) {
    if (error);
    return error.message;
  }
};

/**
 * Schedule Service API
 */
const scheduleService = {
  getScheduleDetail: async (req, res) => {
    const { schedule_id, presence_id } = req.params;
    const { schedule_type: type } = req.query;
    try {
      // query Schedule
      let schedule;
      let presence;
      if (type === 'defined_schedules') {
        schedule = await DefinedSchedulesModel.findOne({
          where: { id: schedule_id },
          include: [
            {
              model: EmployeesModel,
              attributes: ['id'],
              include: [
                { model: UserModel, attributes: ['full_name'] },
                {
                  model: DigitalAssetsModel,
                  required: false,
                  attributes: ['url', 'type'],
                  where: {
                    type: 'avatar'
                  },
                  as: 'assets'
                },
                {
                  model: CompanyModel,
                  required: false
                }
              ]
            },
            {
              model: ScheduleShiftDetailModel,
              where: { schedule_type: 'defined_Schedules' },
              required: false,
              as: 'shift',
              include: {
                model: ScheduleShift
              }
            },
            {
              model: ScheduleNotesModel,
              required: false,
              where: { schedule_type: 'defined_schedules' },
              as: 'notes'
            }
          ]
        });
      }
      if (type === 'schedule_templates') {
        schedule = await ScheduleTemplate.findOne({
          where: { id: schedule_id },
          include: [
            {
              model: EmployeesModel,
              attributes: ['id'],
              include: [
                { model: UserModel, attributes: ['full_name'] },
                {
                  model: DigitalAssetsModel,
                  required: false,
                  attributes: ['url', 'type'],
                  where: {
                    type: 'avatar'
                  },
                  as: 'assets'
                },
                {
                  model: CompanyModel,
                  required: false
                }
              ]
            },
            {
              model: ScheduleShiftDetailModel,
              where: { schedule_type: 'schedule_templates' },
              required: false,
              as: 'shift',
              include: {
                model: ScheduleShift
              }
            },
            {
              model: ScheduleNotesModel,
              required: false,
              where: { schedule_type: 'schedule_templates' },
              as: 'notes'
            }
          ]
        });
      }
      if (!schedule) {
        return res.status(400).json(response(false, 'Jadwal tidak ditemukan'));
      }
      // query Presence
      if (presence_id !== 'null') {
        presence = await queryPresences(presence_id);
      }
      // Compose Response
      const responses = {
        schedule: {
          id: schedule.id,
          type,
          full_name: schedule.employee.user.full_name,
          avatar: schedule.employee.assets.length ? schedule.employee.assets[0].url : null,
          shift_name: schedule.shift.schedule_shift.shift_name,
          start_time: schedule.shift.schedule_shift.start_time,
          end_time: schedule.shift.schedule_shift.end_time,
          branch: schedule.employee.company.name || schedule.employee.company.company_name,
          note: schedule.notes
            ? {
                id: schedule.notes.id,
                text: schedule.notes.note
              }
            : null
        },
        presence: presence || null
      };
      return res
        .status(200)
        .json(response(true, 'Berhasil mendapatkan detail jadwal dan presensi', responses));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = scheduleService;

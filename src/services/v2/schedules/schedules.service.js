require('module-alias/register');
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const {
  response,
  scheduleTemplates: scheduleTemplatesHelpers,
  definedSchedules: definedSchedulesHelpers
  // findConflictedTemplateSchedule
} = require('@helpers');
const {
  companies: CompanyModel,
  schedule_shifts: ScheduleShift,
  defined_schedules: DefinedSchedule,
  division_schedules: DivisionSchedules,
  schedule_shift_details: ScheduleShiftDetails,
  employees: Employee,
  users: User,
  digital_assets: DigitalAsset,
  schedule_templates: ScheduleTemplate,
  salary_groups: SalaryGroup
} = require('@models');

const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const scheduleService = {
  create: async (req, res) => {
    const { data } = req.body;
    const { company_id: companyId } = req.params;
    const { id, employeeId } = res.local.users;
    try {
      const companyData = await CompanyModel.findOne({ where: { id: companyId } });
      if (!companyData) {
        return res.status(400).json(response(false, 'wrong company ID'));
      }

      const payload = Object.assign({}, data, { company_id: companyId });
      const shift = await ScheduleShift.create(payload);

      // SEND NOTIFICATION TO MANAGERS
      const checkUser = await User.findOne({ where: { id } });
      const description = `${checkUser.full_name} telah membuat waktu kerja dengan nama ${data.shift_name}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });

      return res.status(201).json(response(true, 'Berhasil membuat waktu kerja', shift));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  get: async (req, res) => {
    const { company_id: companyId } = req.params;
    const { type } = req.query;
    const companyIdArr = companyId.split(',');
    try {
      const companyData = await CompanyModel.findAll({ where: { id: companyIdArr } });
      if (companyData.length <= 0) {
        return res.status(400).json(response(false, 'wrong company ID'));
      }
      const shiftData = await ScheduleShift.findAll({
        where: [
          { company_id: companyIdArr, is_deleted: 0 },
          type === '1' && { use_salary_per_shift: { [Op.or]: [null, 0] } },
          type === '2' && { use_salary_per_shift: 1 }
        ],
        include: [
          {
            model: CompanyModel,
            attributes: ['id', 'codename', 'company_name', 'name']
          },
          { model: SalaryGroup }
        ],
        order: [[Sequelize.col('company.id'), 'ASC']]
      });
      const responses = [];
      shiftData.forEach(val => {
        const compose = {
          id: val.id,
          company_id: val.company_id,
          shift_name: val.shift_name,
          shift_multiply: val.shift_multiply,
          start_time: val.start_time,
          end_time: val.end_time,
          is_tommorow: val.is_tommorow,
          salary: val.salary,
          company: val.company.company_name || val.company.name,
          color: val.color,
          use_salary_per_shift: val.use_salary_per_shift,
          salary_group: val.salary_group
        };
        responses.push(compose);
      });
      if (!shiftData.length) {
        return res.status(400).json(response(false, 'Tidak ada data waktu kerja'));
      }
      responses.sort((prev, next) => {
        // Sort By Clock ASC
        if (prev.start_time < next.start_time) return -1;
        if (prev.start_time > next.start_time) return 1;
      });
      return res.status(201).json(response(true, 'Berhasil memuat waktu kerja kerja', responses));
    } catch (error) {
      return res.status(400).json(response(false, error.errors));
    }
  },
  detailShift: async (req, res) => {
    const { shift_id: shiftId } = req.params;
    try {
      const shiftDetail = await ScheduleShift.findOne({
        where: { id: shiftId },
        include: { model: CompanyModel, attributes: ['id', 'name', 'company_name'] }
      });
      if (!shiftDetail) {
        return res.status(400).json(response(false, 'ID shift tidak tersedia'));
      }
      return res.status(201).json(response(true, 'Berhasil memuat data waktu kerja', shiftDetail));
    } catch (error) {
      return res.status(400).json(response(false, error.errors));
    }
  },
  deleteShift: async (req, res) => {
    const { shift_id: shiftId } = req.params;
    const { id, employeeId } = res.local.users;
    try {
      const shiftDetail = await ScheduleShift.findOne({ where: { id: shiftId } });
      if (!shiftDetail) {
        return res.status(400).json(response(false, 'ID shift tidak tersedia'));
      }
      await ScheduleShift.update({ is_deleted: 1 }, { where: { id: shiftId } });
      // SEND NOTIFICATION TO MANAGERS
      const checkUser = await User.findOne({ where: { id } });
      const description = `${checkUser.full_name} telah menghapus waktu kerja dengan nama ${shiftDetail.shift_name}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      return res.status(201).json(response(true, 'Berhasil menghapus waktu kerja'));
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
  createScheduleOnce: async (req, res) => {
    const { data } = req.body;
    const { employeeId } = res.local.users;
    try {
      // CHECK DOUBLE SCHEDULE
      const employeeIds = [];
      data.member.forEach(val => employeeIds.push(val.employee_id));
      const employees = await Employee.findAll({ where: { id: employeeIds } });
      const getShift = await ScheduleShift.findOne({ where: { id: data.shift } });
      for (const member of employeeIds) {
        let checkSchedule = [];
        const company = employees.find(val => val.id === member);
        checkSchedule = await scheduleTemplatesHelpers(
          data.presence_date,
          member,
          company.company_id,
          true
        );
        const definedSchedule = await definedSchedulesHelpers(
          data.presence_date,
          company.company_id,
          member
        );
        checkSchedule = checkSchedule.concat(definedSchedule);
        for (const schedule of checkSchedule) {
          const shiftStartTime = schedule.shift.schedule_shift.start_time.split(':');
          const shiftEndTime = schedule.shift.schedule_shift.end_time.split(':');
          const incomingStartTime = getShift.start_time.split(':');
          const incomingEndTime = getShift.end_time.split(':');
          const shiftStart = new Date(0, 0, 0, shiftStartTime[0], shiftStartTime[1], 0);
          const shiftEnd = new Date(0, 0, 0, shiftEndTime[0], shiftEndTime[1], 0);
          const incomingStart = new Date(0, 0, 0, incomingStartTime[0], incomingStartTime[1], 0);
          const incomingEnd = new Date(0, 0, 0, incomingEndTime[0], incomingEndTime[1], 0);
          if (
            (incomingStart >= shiftStart && incomingStart <= shiftEnd) ||
            (incomingEnd >= shiftStart && incomingEnd <= shiftEnd)
          ) {
            return res
              .status(400)
              .json(
                response(false, 'Ada jadwal dengan waktu kerja yang saling interlap satu sama lain')
              );
          }
        }
      }
      //
      let memberNames = [];
      for (let i = 0; i < data.member.length; i++) {
        const scheduleCompose = {
          presence_date: data.presence_date,
          employee_id: data.member[i].employee_id,
          company_id: data.company_id
        };

        const createSchedules = await DefinedSchedule.create(scheduleCompose);
        if (data.member[i].division_id) {
          const divisionCompose = {
            division_id: data.member[i].division_id,
            schedule_id: createSchedules.id,
            schedule_type: 'defined_schedules'
          };
          await DivisionSchedules.create(divisionCompose);
        }
        const shiftCompose = {
          shift_id: data.shift,
          schedule_id: createSchedules.id,
          schedule_type: 'defined_schedules'
        };
        await ScheduleShiftDetails.create(shiftCompose);
        const getMemberName = await Employee.findOne({
          where: { id: data.member[i].employee_id },
          include: { model: User, attributes: ['full_name'] }
        });
        memberNames.push(getMemberName.user.full_name);
      }
      // FIND COMPANY ID
      const getCurrentUser = await Employee.findOne({
        where: { id: employeeId },
        include: [{ model: User, attributes: ['full_name'] }]
      });
      // COMPOSE DESCRIPTION FOR NOTIFICATION
      const names = memberNames
        .toString()
        .split(',')
        .join(', ');
      const description = `${getCurrentUser.user.full_name} telah membuat jadwal untuk ${names}`;
      // SEND NOTIFICATION TO MANAGERS
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      return res.status(201).json(response(true, 'Jadwal berhasil dibuat'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  createScheduleContinous: async (req, res) => {
    const { data } = req.body;
    const { employeeId } = res.local.users;
    let payload = Object.assign({}, data);
    const member = data.member;
    const shiftId = data.shift;
    let memberNames = [];
    payload = Object.assign(payload, delete payload.member, delete payload.shift);

    try {
      // CHECK DOUBLE SCHEDULE
      const employeeIds = [];
      data.member.forEach(val => employeeIds.push(val.employee_id));
      const employees = await Employee.findAll({ where: { id: employeeIds } });
      const getShift = await ScheduleShift.findOne({ where: { id: data.shift } });
      for (const member of employeeIds) {
        let checkSchedule = [];
        const company = employees.find(val => val.id === member);
        checkSchedule = await scheduleTemplatesHelpers(
          // USE START TIME SINCE START TIME AND END TIME IS SAME
          data.start_date,
          member,
          company.company_id,
          true
        );
        const definedSchedule = await definedSchedulesHelpers(
          // USE START TIME SINCE START TIME AND END TIME IS SAME
          data.start_date,
          company.company_id,
          member
        );
        checkSchedule = checkSchedule.concat(definedSchedule);
        for (const schedule of checkSchedule) {
          const shiftStartTime = schedule.shift.schedule_shift.start_time.split(':');
          const shiftEndTime = schedule.shift.schedule_shift.end_time.split(':');
          const incomingStartTime = getShift.start_time.split(':');
          const incomingEndTime = getShift.end_time.split(':');
          const shiftStart = new Date(0, 0, 0, shiftStartTime[0], shiftStartTime[1], 0);
          const shiftEnd = new Date(0, 0, 0, shiftEndTime[0], shiftEndTime[1], 0);
          const incomingStart = new Date(0, 0, 0, incomingStartTime[0], incomingStartTime[1], 0);
          const incomingEnd = new Date(0, 0, 0, incomingEndTime[0], incomingEndTime[1], 0);
          if (
            (incomingStart >= shiftStart && incomingStart <= shiftEnd) ||
            (incomingEnd >= shiftStart && incomingEnd <= shiftEnd)
          ) {
            return res
              .status(400)
              .json(
                response(false, 'Ada jadwal dengan waktu kerja yang saling interlap satu sama lain')
              );
          }
        }
      }
      //
      for (let i = 0; i < member.length; i++) {
        Object.assign(payload, {
          employee_id: member[i].employee_id
        });
        const createSchedules = await ScheduleTemplate.create(payload);
        if (member[i].division_id) {
          const divisionCompose = {
            division_id: member[i].division_id,
            schedule_id: createSchedules.id,
            schedule_type: 'schedule_templates'
          };
          await DivisionSchedules.create(divisionCompose);
        }
        const shiftCompose = {
          shift_id: shiftId,
          schedule_id: createSchedules.id,
          schedule_type: 'schedule_templates'
        };
        await ScheduleShiftDetails.create(shiftCompose);
        const getMemberName = await Employee.findOne({
          where: { id: member[i].employee_id },
          include: { model: User, attributes: ['full_name'] }
        });
        memberNames.push(getMemberName.user.full_name);
      }
      // FIND COMPANY ID
      const getCurrentUser = await Employee.findOne({
        where: { id: employeeId },
        include: [{ model: User, attributes: ['full_name'] }]
      });
      // COMPOSE DESCRIPTION FOR NOTIFICATION
      const names = memberNames
        .toString()
        .split(',')
        .join(', ');
      const description = `${getCurrentUser.user.full_name} telah membuat jadwal untuk ${names}`;
      // SEND NOTIFICATION TO MANAGERS
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      return res.status(201).json(response(true, 'Jadwal berhasil dibuat'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getSchedules: async (req, res) => {
    const { company_id: companyId } = req.params;
    const { date } = req.query;
    const { employeeId } = res.local.users;

    try {
      const companyData = await CompanyModel.findOne({
        where: {
          id: companyId
        }
      });
      if (!companyData) {
        return res.status(400).json(response(false, `Failed to fetch: company data doesn't exist`));
      }
      const isMember = await Employee.findOne({
        where: { id: employeeId, role: 2, active: 1 }
      });

      const scheduleTemplates = await scheduleTemplatesHelpers(
        date,
        employeeId,
        companyId,
        isMember
      );
      const definedSchedules = await definedSchedulesHelpers(
        date,
        companyId,
        isMember && employeeId
      );
      const schedules = scheduleTemplates.concat(definedSchedules);
      if (!schedules || schedules.length <= 0) {
        return res.status(400).json(response(false, `Jadwal Tidak Ditemukan`));
      }
      let definedStartTime;
      let definedEndTime;
      let definedStart;
      let definedEnd;
      let scheduleObj;
      let scheduleArray = [];
      const today = new Date();
      for (let i = 0; i < schedules.length; i++) {
        // Handle Response from Schedule Created With V2
        if (schedules[i].shift) {
          let isDateTommorow = schedules[i].shift.schedule_shift.is_tommorow;
          definedStartTime = schedules[i].shift.schedule_shift.start_time.split(':');
          definedEndTime = schedules[i].shift.schedule_shift.end_time.split(':');
          definedStart = new Date(
            isDateTommorow ? today.getFullYear() : 0,
            isDateTommorow ? today.getMonth() : 0,
            isDateTommorow ? today.getDate() : 0,
            definedStartTime[0],
            definedStartTime[1],
            0
          );
          definedEnd = new Date(
            isDateTommorow ? today.getFullYear() : 0,
            isDateTommorow ? today.getMonth() : 0,
            isDateTommorow ? today.getDate() + 1 : 0,
            definedEndTime[0],
            definedEndTime[1],
            0
          );

          scheduleObj = {
            id: schedules[i].start_date ? schedules[i].id : false,
            defined_id: schedules[i].presence_date ? schedules[i].id : false,
            employee: {
              id: schedules[i].employee.id,
              full_name: schedules[i].employee.user.full_name,
              assets: schedules[i].employee.assets
            },
            schedule_date: schedules[i].presence_date,
            schedule_start: schedules[i].shift.schedule_shift.start_time,
            schedule_end: schedules[i].shift.schedule_shift.end_time,
            workhour: Math.abs(definedStart - definedEnd) / 36e5,
            start_time_info: schedules[i].dataValues.start_time_info || null,
            end_time_info: schedules[i].dataValues.end_time_info || null
          };
          scheduleArray.push(scheduleObj);
        } else {
          // Handle Response from Schedule Created With V1
          definedStartTime = schedules[i].presence_start
            ? schedules[i].presence_start.split(':')
            : schedules[i].start_time.split(':');
          definedEndTime = schedules[i].presence_end
            ? schedules[i].presence_end.split(':')
            : schedules[i].end_time.split(':');
          definedStart = new Date(0, 0, 0, definedStartTime[0], definedStartTime[1], 0);
          definedEnd = new Date(0, 0, 0, definedEndTime[0], definedEndTime[1], 0);

          scheduleObj = {
            id: schedules[i].start_date ? schedules[i].id : false,
            defined_id: schedules[i].presence_date ? schedules[i].id : false,
            employee: {
              id: schedules[i].employee.id,
              full_name: schedules[i].employee.user.full_name,
              assets: schedules[i].employee.assets
            },
            schedule_date: schedules[i].presence_date,
            schedule_start: schedules[i].presence_start
              ? schedules[i].presence_start
              : schedules[i].start_time,
            schedule_end: schedules[i].presence_end
              ? schedules[i].presence_end
              : schedules[i].end_time,
            workhour: Math.abs(definedStart - definedEnd) / 36e5,
            start_time_info: null,
            end_time_info: null
          };
          scheduleArray.push(scheduleObj);
        }
      }

      return res
        .status(200)
        .json(response(true, 'Schedule data have been successfully retrieved', scheduleArray));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getScheduleDetail: async (req, res) => {
    const { schedule_id: scheduleId } = req.params;
    const { type } = req.query;
    try {
      let schedule;
      if (type === 'once') {
        schedule = await DefinedSchedule.findOne({
          where: { id: scheduleId },
          include: [
            {
              model: Employee,
              attributes: ['id', 'user_id'],
              include: [
                {
                  model: User,
                  attributes: ['full_name']
                },
                {
                  model: DigitalAsset,
                  required: false,
                  attributes: ['url', 'type'],
                  where: {
                    type: 'avatar'
                  },
                  as: 'assets'
                }
              ]
            },
            { model: CompanyModel, attributes: ['id', 'name', 'company_name'] },
            {
              model: ScheduleShiftDetails,
              required: false,
              where: { schedule_type: 'defined_Schedules' },
              as: 'shift',
              include: {
                model: ScheduleShift
              }
            }
          ]
        });
        if (!schedule) {
          return res.status(400).json(response(false, 'Defined Schedule not found'));
        }
        if (!schedule.shift) {
          delete schedule.dataValues.shift;
          schedule.dataValues.shift = {
            schedule_shift: {
              shift_name: 'Unnamed Shift',
              start_time: schedule.presence_start,
              end_time: schedule.presence_end
            }
          };
        }
      } else if (type === 'continous') {
        schedule = await ScheduleTemplate.findOne({
          where: { id: scheduleId },
          include: [
            {
              model: Employee,
              attributes: ['id', 'user_id'],
              include: [
                {
                  model: User,
                  attributes: ['full_name']
                },
                {
                  model: DigitalAsset,
                  required: false,
                  attributes: ['url', 'type'],
                  where: {
                    type: 'avatar'
                  },
                  as: 'assets'
                }
              ]
            },
            { model: CompanyModel, attributes: ['id', 'name', 'company_name'] },
            {
              model: ScheduleShiftDetails,
              required: false,
              where: { schedule_type: 'schedule_templates' },
              as: 'shift',
              include: {
                model: ScheduleShift
              }
            }
          ]
        });
        if (!schedule) {
          return res.status(400).json(response(false, 'Schedule template not found'));
        }
        if (!schedule.shift) {
          delete schedule.dataValues.shift;
          schedule.dataValues.shift = {
            schedule_shift: {
              shift_name: 'Unnamed Shift',
              start_time: schedule.start_time,
              end_time: schedule.end_time
            }
          };
        }
      }
      return res.status(200).json(response(true, 'Detail jadwal berhasil dimuat', schedule));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  editSchedule: async (req, res) => {
    const { schedule_id: scheduleId } = req.params;
    const { data } = req.body;
    const { employeeId } = res.local.users;
    try {
      let schedules;
      if (data.type === 'once') {
        schedules = await DefinedSchedule.findOne({
          where: { id: scheduleId },
          include: [
            { model: Employee, include: { model: User, attributes: ['full_name'] } },
            {
              required: false,
              model: ScheduleShiftDetails,
              where: { schedule_type: 'defined_schedules' },
              as: 'shift'
            },
            {
              model: DivisionSchedules,
              where: { schedule_type: 'defined_schedules' },
              as: 'division',
              required: false
            }
          ]
        });
        if (!schedules) {
          return res.status(400).json(response(false, 'Jadwal tidak ditemukan'));
        }
        // Repeat type = Null indicate that schedule type will be still Defined Schedule
        if (data.repeat_type === null) {
          if (schedules.shift) {
            const compose = {
              shift_id: data.shift
            };
            await ScheduleShiftDetails.update(compose, {
              where: { schedule_id: scheduleId }
            });
          } else {
            const compose = {
              shift_id: data.shift,
              schedule_id: scheduleId,
              schedule_type: 'defined_schedules'
            };
            await ScheduleShiftDetails.create(compose);
          }
          // Update Schedule Company Branch
          await DefinedSchedule.update(
            { company_id: data.company_id },
            { where: { id: scheduleId } }
          );
          // Repeat type != Null indicate that schedule type will be change from Defined Schedule -> Schedule Templates
        } else {
          const shift = schedules.shift;
          const division = schedules.division;
          const payload = Object.assign({}, data);
          const deleteDefinedSchedules = await DefinedSchedule.destroy({
            where: { id: scheduleId }
          });
          if (!deleteDefinedSchedules) {
            return res.status(400).json(response(false, 'Gagal mengubah jadwal'));
          }
          delete payload.date;
          delete payload.shift;
          delete payload.type;
          delete payload.editType;
          Object.assign(payload, { start_date: data.date, end_date: data.date });
          const createScheduleTemplate = await ScheduleTemplate.create(payload);
          if (!createScheduleTemplate) {
            return res.status(400).json(response(false, 'Gagal mengubah jadwal'));
          }
          const compose = {
            shift_id: data.shift,
            schedule_id: createScheduleTemplate.id,
            schedule_type: 'schedule_templates'
          };
          if (schedules.shift) {
            await ScheduleShiftDetails.update(compose, {
              where: { id: shift.id }
            });
          } else {
            await ScheduleShiftDetails.create(compose);
          }
          if (division !== null) {
            const compose = {
              schedule_id: createScheduleTemplate.id,
              schedule_type: 'schedule_templates'
            };
            const editDivision = await DivisionSchedules.update(compose, {
              where: { id: division.id }
            });
            if (!editDivision) {
              return res.status(400).json(response(false, 'Gagal mengubah jadwal'));
            }
          }
        }
      } else if (data.type === 'continous') {
        schedules = await ScheduleTemplate.findOne({
          where: { id: scheduleId },
          include: [
            { model: Employee, include: { model: User, attributes: ['full_name'] } },
            {
              required: false,
              model: ScheduleShiftDetails,
              where: { schedule_type: 'schedule_templates' },
              as: 'shift'
            },
            {
              model: DivisionSchedules,
              where: { schedule_type: 'schedule_templates' },
              as: 'division',
              required: false
            }
          ]
        });
        if (!schedules) {
          return res.status(400).json(response(false, 'Jadwal tidak ditemukan', schedules));
        }
        let compose;
        if (data.editType === 'after') {
          // Repeat type = null indicate that schedule template will be changed to defined schedule
          if (data.repeat_type === null && schedules.start_date === schedules.end_date) {
            compose = {
              deleted_after: data.date
            };
            const updateScheduleTemplate = await ScheduleTemplate.update(compose, {
              where: { id: scheduleId }
            });
            if (!updateScheduleTemplate) {
              return res.status(400).json(response(false, 'Gagal mengubah jadwal'));
            }
            compose = {
              employee_id: data.employee_id,
              presence_date: data.date,
              company_id: data.company_id
            };
            const createDefinedSchedule = await DefinedSchedule.create(compose);
            if (!createDefinedSchedule) {
              return res.status(400).json(response(false, 'Gagal mengubah jadwal'));
            }
            compose = {
              shift_id: data.shift,
              schedule_id: createDefinedSchedule.id,
              schedule_type: 'defined_schedules'
            };
            const createShift = await ScheduleShiftDetails.create(compose);
            if (!createShift) {
              return res.status(400).json(response(false, 'Gagal mengubah jadwal'));
            }
            if (schedules.division !== null) {
              const compose = {
                division_id: schedules.division.division_id,
                schedule_id: createDefinedSchedule.id,
                schedule_type: 'defined_schedules'
              };
              const createDivision = await DivisionSchedules.create(compose);
              if (!createDivision) {
                return res.status(400).json(response(false, 'Gagal mengubah jadwal'));
              }
            }
            // Repeat type != null indicate that schedule template will remain schedule template
          } else {
            compose = {
              deleted_after: data.date
            };
            const updateScheduleTemplate = await ScheduleTemplate.update(compose, {
              where: { id: scheduleId }
            });
            if (!updateScheduleTemplate) {
              return res.status(400).json(response(false, 'Gagal mengubah jadwal'));
            }
            const payload = Object.assign({}, data);
            delete payload.date;
            delete payload.shift;
            delete payload.type;
            delete payload.editType;
            Object.assign(payload, {
              start_date: data.date,
              end_date: schedules.end_date,
              deleted_after: schedules.deleted_after !== null ? schedules.deleted_after : null
            });
            const createScheduleTemplate = await ScheduleTemplate.create(payload);
            if (!createScheduleTemplate) {
              return res.status(400).json(response(false, 'Gagal mengubah jadwal'));
            }
            compose = {
              shift_id: data.shift,
              schedule_id: createScheduleTemplate.id,
              schedule_type: 'schedule_templates'
            };
            const createShift = await ScheduleShiftDetails.create(compose);
            if (!createShift) {
              return res.status(400).json(response(false, 'Gagal mengubah jadwal'));
            }
            if (schedules.division !== null) {
              const compose = {
                division_id: schedules.division.division_id,
                schedule_id: createScheduleTemplate.id,
                schedule_type: 'schedule_templates'
              };
              const createDivision = await DivisionSchedules.create(compose);
              if (!createDivision) {
                return res.status(400).json(response(false, 'Gagal mengubah jadwal'));
              }
            }
          }
        } else if (data.editType === 'this') {
          const existedDeletedDate = schedules.deleted_date !== null ? schedules.deleted_date : '';
          compose = {
            deleted_date: existedDeletedDate.concat(
              `${schedules.deleted_date !== null ? ',' : ''}${data.date}`
            )
          };
          const updateScheduleTemplate = await ScheduleTemplate.update(compose, {
            where: { id: scheduleId }
          });
          if (!updateScheduleTemplate) {
            return res.status(400).json(response(false, 'Gagal mengubah jadwal'));
          }
          compose = {
            employee_id: data.employee_id,
            presence_date: data.date,
            company_id: data.company_id
          };
          const createDefinedSchedule = await DefinedSchedule.create(compose);
          if (!createDefinedSchedule) {
            return res.status(400).json(response(false, 'Gagal mengubah jadwal'));
          }
          compose = {
            shift_id: data.shift,
            schedule_id: createDefinedSchedule.id,
            schedule_type: 'defined_schedules'
          };
          const createShift = await ScheduleShiftDetails.create(compose);
          if (!createShift) {
            return res.status(400).json(response(false, 'Gagal mengubah jadwal'));
          }
          if (schedules.division !== null) {
            const compose = {
              division_id: schedules.division.division_id,
              schedule_id: createDefinedSchedule.id,
              schedule_type: 'defined_schedules'
            };
            const createDivision = await DivisionSchedules.create(compose);
            if (!createDivision) {
              return res.status(400).json(response(false, 'Gagal mengubah jadwal'));
            }
          }
        }
      }
      // GET CURRENT USER DATA
      const getCurrentUser = await Employee.findOne({
        where: { id: employeeId },
        include: [{ model: User, attributes: ['full_name'] }]
      });
      const description = `${getCurrentUser.user.full_name} telah mengedit waktu kerja milik ${schedules.employee.user.full_name}`;
      // SEND NOTIFICATION TO MANAGERS
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      return res.status(200).json(response(true, 'Jadwal berhasil diubah'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  deleteSchedule: async (req, res) => {
    const { schedule_id: scheduleId } = req.params;
    const { type, editType, date } = req.query;
    const { employeeId } = res.local.users;
    try {
      let compose;
      let schedules;
      if (type === 'continous') {
        schedules = await ScheduleTemplate.findOne({
          where: { id: scheduleId },
          include: { model: Employee, include: { model: User, attributes: ['full_name'] } }
        });
        if (!schedules) {
          return res.status(400).json(response(false, 'Jadwal tidak ditemukan'));
        }
        if (editType === 'this') {
          const existedDeletedDate = schedules.deleted_date !== null ? schedules.deleted_date : '';
          compose = {
            deleted_date: existedDeletedDate.concat(
              `${schedules.deleted_date !== null ? ',' : ''}${date}`
            )
          };
          const editSchedule = await ScheduleTemplate.update(compose, {
            where: { id: scheduleId }
          });
          if (!editSchedule) {
            return res.status(400).json(response(false, 'Gagal menghapus jadwal'));
          }
        } else if (editType === 'after') {
          compose = {
            deleted_after: date
          };
          const editSchedule = await ScheduleTemplate.update(compose, {
            where: { id: scheduleId }
          });
          if (!editSchedule) {
            return res.status(400).json(response(false, 'Gagal menghapus jadwal'));
          }
        }
      } else if (type === 'once') {
        schedules = await DefinedSchedule.findOne({
          where: { id: scheduleId },
          include: [
            { model: Employee, include: { model: User, attributes: ['full_name'] } },
            {
              required: false,
              model: ScheduleShiftDetails,
              where: { schedule_type: 'defined_schedules' },
              as: 'shift'
            },
            {
              model: DivisionSchedules,
              where: { schedule_type: 'defined_schedules' },
              as: 'division',
              required: false
            }
          ]
        });
        if (!schedules) {
          return res.status(400).json(response(false, 'Jadwal tidak ditemukan'));
        }
        const deleteSchedule = await DefinedSchedule.destroy({ where: { id: scheduleId } });
        if (!deleteSchedule) {
          return res.status(400).json(response(false, 'Gagal menghapus jadwal'));
        }
        if (schedules.shift) {
          const deleteShift = await ScheduleShiftDetails.destroy({
            where: { schedule_id: scheduleId, schedule_type: 'defined_schedules' }
          });
          if (!deleteShift) {
            return res.status(400).json(response(false, 'Gagal menghapus jadwal'));
          }
        }
        if (schedules.division) {
          const deleteDivision = await DivisionSchedules.destroy({
            where: { schedule_id: scheduleId, schedule_type: 'defined_schedules' }
          });
          if (!deleteDivision) {
            return res.status(400).json(response(false, 'Gagal menghapus jadwal'));
          }
        }
      }
      // FIND COMPANY ID
      const getCurrentUser = await Employee.findOne({
        where: { id: employeeId },
        include: [{ model: User, attributes: ['full_name'] }]
      });
      const description = `${getCurrentUser.user.full_name} telah mengapus waktu kerja milik ${schedules.employee.user.full_name}`;
      // SEND NOTIFICATION TO MANAGERS
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      return res.status(200).json(response(true, 'Jadwal berhasil dihapus'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = scheduleService;

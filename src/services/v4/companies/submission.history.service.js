require('module-alias/register');
const { response } = require('@helpers');
const {
  Sequelize: { Op }
} = require('sequelize');
const {
  companies: Company,
  employees: EmployeeModel,
  digital_assets: DigitalAsset,
  submissions: SubmissionsModel,
  users: UserModel,
  schedule_submissions: ScheduleSubmission,
  defined_schedules: DefinedSchedule,
  schedule_shift_details: ScheduleShiftDetail,
  schedule_shifts: ScheduleShift,
  schedule_swaps: ScheduleSwap
} = require('@models');

const submissionsHistory = {
  getSubmissionHistory: async (req, res) => {
    const { company_id: companyId } = req.params;
    const { employeeId, employeeRole } = res.local.users;

    try {
      const checkCompany = await Company.findOne({
        where: { parent_company_id: companyId }
      });
      if (!checkCompany) {
        return res.status(400).json(response(false, 'Perusahaan tidak ditemukan'));
      }

      const presenceSubmissions = await SubmissionsModel.findAll({
        order: [['created_at', 'desc']],
        where: [
          {},
          employeeRole !== 1 && { employee_id: employeeId },
          { [Op.or]: [{ type: 2 }, { type: 6 }] },
          { [Op.or]: [{ status: 1 }, { status: -1 }] }
        ],
        include: [
          {
            model: EmployeeModel,
            attributes: ['id'],
            required: false,
            include: [
              { model: UserModel, attributes: ['full_name'] },
              {
                model: DigitalAsset,
                attributes: ['url'],
                required: false,
                where: {
                  type: 'avatar'
                },
                as: 'assets'
              },
              {
                model: Company,
                attributes: ['company_name', 'name'],
                required: true,
                where: { parent_company_id: companyId }
              }
            ]
          }
        ]
      });

      let employeeIds = [];
      const employee = await EmployeeModel.findOne({
        where: { id: employeeId },
        attributes: ['company_id']
      });
      if (employeeRole == 1) {
        const employees = await EmployeeModel.findAll({
          where: { company_id: employee.company_id, role: { [Op.ne]: 1 } },
          attributes: ['id']
        });
        employeeIds = employees.map(val => val.id);
      }
      const scheduleSubmissions = await ScheduleSubmission.findAll({
        where: {
          employee_id: employeeRole === 1 ? employeeIds : employeeId,
          status: { [Op.ne]: 0 }
        },
        include: [
          {
            model: EmployeeModel,
            attributes: ['id'],
            required: true,
            include: [
              {
                model: Company,
                where: { parent_company_id: companyId },
                required: true
              },
              {
                model: UserModel,
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
          {
            model: DefinedSchedule,
            include: {
              model: ScheduleShiftDetail,
              where: { schedule_type: 'defined_Schedules' },
              required: false,
              as: 'shift',
              include: {
                model: ScheduleShift
              }
            }
          }
        ]
      });

      const scheduleSwaps = await ScheduleSwap.findAll({
        where: { [Op.or]: [{ status: 2 }, { status: -1 }], company_id: employee.company_id },
        include: { model: Company, attributes: ['company_name', 'name'] }
      });
      for (const [index, value] of scheduleSwaps.entries()) {
        const employees = await EmployeeModel.findAll({
          where: { id: [value.self_id, value.away_id] },
          attributes: ['id'],
          include: [
            {
              model: UserModel,
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
        });
        scheduleSwaps[index].dataValues.employee = employees;
      }

      const responses = [];
      for (const data of presenceSubmissions) {
        let submissionName = 'Tambah Jatah Cuti';
        if (data.presence_type === 1) submissionName = 'Cuti';
        if (data.presence_type === 2) submissionName = 'Izin';
        responses.push({
          submission_id: data.id,
          employee_id: data.employee_id,
          full_name: data.employee.user.full_name,
          avatar: data.employee.assets.length ? data.employee.assets[0].url : null,
          presence_type_name: submissionName,
          branch: data.employee.company.company_name || data.employee.company.company_name,
          status: data.status,
          created_at: data.created_at
        });
      }

      for (const data of scheduleSubmissions) {
        responses.push({
          id: data.defined_schedule.id,
          full_name: data.employee.user.full_name,
          description: data.type === 1 ? 'Lempar Jadwal' : 'Menerima Jadwal',
          avatar: data.employee.assets.length ? data.employee.assets[0].url : null,
          start_time: data.defined_schedule.shift.schedule_shift.start_time,
          end_time: data.defined_schedule.shift.schedule_shift.end_time,
          branch: data.employee.company.company_name || data.employee.company.name,
          created_at: data.created_at,
          status: data.status
        });
      }

      for (const data of scheduleSwaps) {
        responses.push({
          id: data.id,
          full_name: data.dataValues.employee[0].user.full_name,
          description: 'Tukar jadwal',
          avatar: data.dataValues.employee[0].assets.length
            ? data.dataValues.employee[0].assets[0].url
            : null,
          away_avatar: data.dataValues.employee[1].assets.length
            ? data.dataValues.employee[1].assets[0].url
            : null,
          branch: data.company.company_name || data.company.name,
          created_at: data.created_at,
          status: data.status === 2 ? 1 : -1
        });
      }

      return res
        .status(200)
        .json(response(true, 'Berhasil mendapatkan riwayat pengajuan', responses));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = submissionsHistory;

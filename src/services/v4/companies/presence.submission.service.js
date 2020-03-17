require('module-alias/register');
const { response } = require('@helpers');
const {
  Sequelize,
  submissions: SubmissionsModel,
  employees: EmployeesModel,
  users: UserModel,
  companies: CompaniesModel,
  digital_assets: DigitalAsset,
  presences: PresenceModel,
  home_dumps: HomeDump
} = require('@models');
const { Op } = Sequelize;

class PresenceSubmission {
  constructor(req, res) {
    this.req = req;
    this.res = res;
  }

  async getPresenceSubmission() {
    const { company_id } = this.req.params;
    const { dateInfo: today } = this.req.query;
    const { companyParentId, employeeId } = this.res.local.users;
    const companyIds = company_id.split(',');

    try {
      let data = [];
      let dumps = [];

      if (today) {
        dumps = await HomeDump.findAll({
          where: [
            { parent_company_id: companyParentId },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
              today
            )
          ]
        });
      }

      // Get User Role
      const userRole = await EmployeesModel.findOne({
        where: { id: employeeId, active: 1 },
        attributes: ['role']
      });

      const submissions = await SubmissionsModel.findAll({
        where: { [Op.or]: [{ type: 2 }, { type: 6 }], status: 0 },
        attributes: [
          'id',
          'employee_id',
          'start_date',
          'end_date',
          'note',
          'type',
          'presence_type',
          'status'
        ],
        include: [
          {
            model: EmployeesModel,
            where: { company_id: { [Op.in]: companyIds } },
            include: [
              {
                model: UserModel,
                attributes: ['full_name']
              },
              {
                model: CompaniesModel,
                attributes: ['name', 'company_name']
              },
              {
                model: DigitalAsset,
                attributes: ['url'],
                required: false,
                where: {
                  type: 'avatar'
                },
                as: 'assets'
              }
            ]
          }
        ]
      });

      const presences = await PresenceModel.findAll({
        where: {
          custom_presence: 1,
          presence_start: { [Op.ne]: null }
        },
        include: {
          model: EmployeesModel,
          where: { company_id: companyIds },
          required: true,
          include: [
            {
              model: UserModel,
              attributes: ['full_name']
            },
            {
              model: DigitalAsset,
              attributes: ['url'],
              required: false,
              where: {
                type: 'avatar'
              },
              as: 'assets'
            },
            { model: CompaniesModel, attributes: ['name', 'company_name'] }
          ]
        }
      });
      // Insert Leave Submission
      if (submissions.length) {
        for (const submission of submissions) {
          let description;
          if (submission.type === 2 && submission.presence_type === 2) description = 'Izin';

          if (submission.type === 2 && submission.presence_type === 1) description = 'Cuti';

          if (submission.type === 6) description = 'Tambah Jatah Cuti';
          data.push({
            id: submission.id,
            employee_id: submission.employee_id,
            full_name: submission.employee.user.full_name,
            start_date: submission.start_date,
            end_date: submission.end_date,
            description,
            type: submission.type,
            status: submission.status,
            branch: submission.employee.company.name || submission.employee.company.company_name,
            avatar: submission.employee.assets.length ? submission.employee.assets[0].url : null,
            can_response: true
          });
        }
      }
      // Insert Presence Data
      if (presences.length) {
        for (const presence of presences) {
          data.push({
            id: presence.id,
            employee_id: presence.employee_id,
            full_name: presence.employee.user.full_name,
            start_date: presence.presence_date,
            description: 'Ceklok Lokasi Lain',
            type: 1,
            branch: presence.employee.company.name || presence.employee.company.company_name,
            avatar: presence.employee.assets.length ? presence.employee.assets[0].url : null,
            can_response: true
          });
        }
      }

      if (userRole.role === 2) {
        data = data
          .map(val => ({ ...val, can_response: false }))
          .filter(val => val.employee_id == employeeId);
      }

      if (userRole.role !== 1 && userRole.role !== 2) {
        data = data.map(val => ({ ...val, can_response: val.employee_id !== employeeId }));
      }

      if (dumps.length)
        data = data.filter(
          item =>
            !dumps.filter(val => {
              return (
                (val.type == 10 || val.type == 9) &&
                val.identifier === item.start_date &&
                val.employee_id === item.employee_id
              );
            }).length
        );

      return this.res
        .status(200)
        .json(response(true, 'Data pengajuan presensi berhasil didapatkan', data));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
}

module.exports = PresenceSubmission;

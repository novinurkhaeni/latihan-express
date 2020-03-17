require('module-alias/register');
const { response } = require('@helpers');
const {
  Sequelize,
  submissions: SubmissionsModel,
  employees: EmployeesModel,
  users: UserModel,
  companies: CompaniesModel,
  digital_assets: DigitalAsset
} = require('@models');
const { Op } = Sequelize;

class MemberSubmission {
  constructor(req, res) {
    this.req = req;
    this.res = res;
  }

  async getMembersSubmission() {
    const { company_id } = this.req.params;
    const companyIds = company_id.split(',');

    try {
      const data = [];
      const submissions = await SubmissionsModel.findAll({
        where: {
          [Op.or]: [{ type: 5 }, { type: 6 }]
        },
        attributes: ['id', 'employee_id', 'type', 'date', 'note', 'amount'],
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
                attributes: ['name']
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

      if (submissions.length > 0) {
        for (const submission of submissions) {
          data.push({
            id: submission.id,
            employee_id: submission.employee_id,
            type: submission.type,
            full_name: submission.employee.user.full_name,
            date: submission.date,
            description: submission.note,
            amount: submission.amount,
            branch: submission.employee.company.name,
            avatar: submission.employee.assets.length
              ? submission.employee.assets[0].dataValues.url
              : null
          });
        }
      }

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

module.exports = MemberSubmission;

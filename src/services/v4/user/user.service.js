require('module-alias/register');

const { response, jwtHelpers, abilityFinder } = require('@helpers');
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const {
  users: User,
  employees: Employee,
  pins: Pin,
  companies: Company,
  abilities: Ability,
  access_tokens: AccessToken
} = require('@models');
const config = require('config');

const userService = {
  checkUserStatus: async (req, res) => {
    const { user_id } = req.params;
    try {
      // Check User Status in Company
      const employee = await Employee.findOne({
        order: [['id', 'desc']],
        include: [
          { model: Company, attributes: ['id', 'parent_company_id'] },
          { model: Ability },
          { model: User, include: { model: Pin, required: false } }
        ],
        where: { user_id, active: 1 }
      });
      if (!employee) {
        return res
          .status(400)
          .json(response(false, 'Permintaan gabung perusahaan ditolak', { active: 0 }));
      }
      if (employee && employee.flag == 2) {
        return res
          .status(200)
          .json(response(true, 'Masih menunggu respon pemilik usaha', { flag: employee.flag }));
      }
      if (employee && employee.flag == 3) {
        // Generate New Token if Employee Approved to Join Company
        const expires = 365 * 24 * 60 * 60;
        const token = jwtHelpers.createJWT(
          Object.assign({
            email: employee.user.email,
            phone: employee.user.phone,
            id: employee.user.id,
            employeeId: employee.id,
            employeeRole: employee.role,
            companyParentId: employee.company.parent_company_id
          }),
          config.authentication.secret,
          expires
        );
        const payload = {
          access_token: token,
          refresh_token: jwtHelpers.refreshToken(),
          user_id,
          expiry_in: expires,
          client_id: 'app'
        };

        let accessToken = await AccessToken.findOne({
          where: {
            user_id,
            [Op.or]: [{ client_id: null }, { client_id: 'app' }]
          }
        });

        if (!accessToken) {
          await AccessToken.create(payload);
        } else {
          await AccessToken.update(payload, {
            where: {
              user_id,
              [Op.or]: [{ client_id: null }, { client_id: 'app' }]
            }
          });
        }
        accessToken = await AccessToken.findOne({
          where: {
            user_id,
            [Op.or]: [{ client_id: null }, { client_id: 'app' }]
          },
          include: [{ model: User, as: 'user' }]
        });

        if (!accessToken) {
          return res.status(400).json(response(false, 'Terjadi kesalahan saat membuat token'));
        }

        accessToken = Object.assign({}, accessToken.dataValues, {
          company_id: employee.company.id,
          employee_id: employee.id,
          flag: employee.flag,
          role: employee.role,
          active: employee.active,
          pin: employee.user.pin.pin,
          pin_id: employee.user.pin.id,
          ability: await abilityFinder(employee)
        });
        return res
          .status(200)
          .json(response(true, 'Permintaan gabung perusahaan disetujui', accessToken));
      }
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }

      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = userService;

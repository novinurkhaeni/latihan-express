require('module-alias/register');
const { response, dateConverter } = require('@helpers');
const {
  companies: Company,
  employees: Employee,
  presences: Presence,
  users: User,
  digital_assets: DigitalAsset,
  pins: Pin,
  Sequelize
} = require('@models');
const { Op } = Sequelize;

const members = {
  get: async (req, res) => {
    const { company_id } = req.params;
    const companyIds = company_id.split(',');
    try {
      const today = dateConverter(new Date());
      const employees = await Employee.findAll({
        attributes: ['id', 'role', 'user_id'],
        where: { role: { [Op.ne]: 1 }, active: 1 },
        include: [
          {
            model: Company,
            attributes: ['id'],
            where: {
              id: companyIds
            }
          },
          {
            model: Presence,
            required: false,
            attributes: ['presence_start', 'presence_end'],
            where: {
              presence_date: today,
              presence_start: { [Op.ne]: null },
              presence_end: null
            }
          },
          {
            model: User,
            attributes: ['full_name'],
            include: {
              model: Pin,
              attributes: ['pin']
            }
          },
          {
            model: DigitalAsset,
            required: false,
            where: {
              type: 'avatar'
            },
            as: 'assets'
          }
        ]
      });
      if (!employees) return res.status(400).json(response(false, 'Anggota tidak ditemukan'));
      const payload = [];
      for (let i = 0; i < employees.length; i++) {
        const assets = employees[i].assets;
        const isCheckin = employees[i].presences.length;
        payload.push({
          id: employees[i].id,
          user_id: employees[i].user_id,
          company_id: employees[i].company.id,
          role: employees[i].role,
          full_name: employees[i].user.full_name,
          assets: assets.length ? assets[0].url : null,
          pin: employees[i].user.pin ? employees[i].user.pin.pin : null,
          is_checkin: isCheckin !== 0
        });
      }
      return res.status(200).json(response(true, 'Anggota berhasil di dapatkan', payload));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = members;

require('module-alias/register');
const { presences: Presences } = require('@models');
const Sequelize = require('sequelize');
const { Op } = Sequelize;

const presences = async (startDate, employee_id) => {
  const employee_presences = await Presences.findAll({
    where: [
      {
        presence_date: {
          [Op.between]: [new Date(startDate), new Date()]
        }
      },
      {
        employee_id: employee_id
      }
    ]
  });
  return employee_presences;
};

module.exports = presences;

'use strict';
require('module-alias/register');
const { pins: Pin, employees: Employee } = require('@models');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Polulate PIN data
    const pins = await Pin.findAll({
      attributes: ['employee_id']
    });
    const datas = [];
    for (const pin of pins) {
      const employee = await Employee.findOne({
        where: { id: pin.dataValues.employee_id },
        attributes: ['user_id', 'id']
      });
      datas.push({ user_id: employee.user_id, employee_id: employee.id });
    }

    for (const data of datas) {
      await queryInterface.bulkUpdate(
        'pins',
        { user_id: data.user_id },
        { employee_id: data.employee_id }
      );
    }
    return;
  },

  down: async (queryInterface, Sequelize) => {
    //
  }
};

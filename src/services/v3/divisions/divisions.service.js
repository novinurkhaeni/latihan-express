require('module-alias/register');
const { response } = require('@helpers');
const {
  sequelize,
  divisions: Divisions,
  division_details: DivisionDetails,
  companies: CompanyModel,
  employees: EmployeeModel,
  users: UserModel
} = require('@models');
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const divisionService = {
  create: async (req, res) => {
    const { id, employeeId } = res.local.users;
    const { data } = req.body;
    const transaction = await sequelize.transaction();
    try {
      let payload;
      const checkCompany = await CompanyModel.findOne({ where: { id: data.company_id } });
      if (!checkCompany) {
        return res.status(400).json(response(false, 'Id company tidak ditemukan'));
      }
      payload = {
        name: data.name,
        company_id: data.company_id
      };
      const createDivision = await Divisions.create(payload, { transaction });
      if (!createDivision) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal membuat divisi'));
      }
      payload = [];
      let memberArray = data.member;
      memberArray.forEach(value => {
        payload.push({ employee_id: value.id, division_id: createDivision.id, leadership: 0 });
      });
      if (data.leader.length) {
        payload.push({
          employee_id: data.leader[0].id,
          division_id: createDivision.id,
          leadership: 1
        });
        const updateEmployee = await EmployeeModel.update(
          { role: 6 },
          { where: { id: data.leader[0].id } },
          { transaction }
        );
        if (!updateEmployee) {
          await transaction.rollback();
          return res.status(400).json(response(false, 'Gagal membuat divisi'));
        }
      }
      const createDivisionDetail = await DivisionDetails.bulkCreate(payload, { transaction });
      if (!createDivisionDetail) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal membuat divisi'));
      }
      // SEND NOTIFICATION TO MANAGERS
      const checkUser = await UserModel.findOne({ where: { id } });
      const description = `${checkUser.full_name} telah membuat divisi dengan nama ${data.name}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });

      await transaction.commit();
      return res.status(201).json(response(true, 'Berhasil membuat divisi'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = divisionService;

require('module-alias/register');
const { response } = require('@helpers');
const {
  divisions: Divisions,
  division_details: DivisionDetails,
  companies: CompanyModel,
  employees: EmployeeModel,
  users: UserModel,
  digital_assets: DigitalAsset
} = require('@models');
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const divisionsService = {
  getDivision: async (req, res) => {
    const { company_id } = req.params;
    const companyIdArr = company_id.split(',');
    try {
      const checkCompany = await CompanyModel.findAll({ where: { id: companyIdArr } });
      if (checkCompany.length <= 0) {
        return res.status(400).json(response(false, 'Id company tidak ditemukan'));
      }
      const division = await Divisions.findAll({
        where: { company_id: companyIdArr },
        include: [
          {
            model: DivisionDetails,
            include: {
              model: EmployeeModel,
              attributes: ['id'],
              include: [
                { model: UserModel, attributes: ['full_name', 'id'] },
                {
                  model: DigitalAsset,
                  attributes: ['url'],
                  required: false,
                  where: { type: 'avatar' },
                  as: 'assets'
                }
              ],
              where: { active: 1 }
            }
          },
          {
            model: CompanyModel,
            attributes: ['name', 'company_name']
          }
        ]
      });

      if (division.length === 0) {
        return res.status(400).json(response(false, 'Tidak ada divisi'));
      }
      let payload = [];
      division.forEach(value => {
        let memberList = [];
        let counter = 1;
        value.division_details.forEach(data => {
          if (counter <= 3) {
            memberList.push(data.employee.user.full_name);
          }
          counter++;
        });
        value.division_details.sort((prev, next) => {
          // Sort Leadership DESC
          if (prev.leadership < next.leadership) return 1;
          if (prev.leadership > next.leadership) return -1;
        });
        const compose = {
          id: value.id,
          name: value.name,
          member: memberList.length !== 0 ? memberList.toString() : 'Tidak ada member',
          raw: value.division_details,
          company: value.company.company_name || value.company.name
        };
        payload.push(compose);
      });
      payload.sort((prev, next) => {
        // Sort By Name ASC
        if (prev.name < next.name) return -1;
        if (prev.name > next.name) return 1;
      });

      return res.status(200).json(response(true, 'Berhasil memuat data divisi', payload));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  createDivision: async (req, res) => {
    const { company_id } = req.params;
    const { id, employeeId } = res.local.users;
    const { data } = req.body;
    try {
      let payload;
      const checkCompany = await CompanyModel.findOne({ where: { id: company_id } });
      if (!checkCompany) {
        return res.status(400).json(response(false, 'Id company tidak ditemukan'));
      }
      payload = {
        name: data.name,
        company_id
      };
      const createDivision = await Divisions.create(payload);
      if (!createDivision) {
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
      }
      const createDivisionDetail = await DivisionDetails.bulkCreate(payload);
      if (!createDivisionDetail) {
        return res.status(400).json(response(false, 'Gagal membuat divisi'));
      }
      // SEND NOTIFICATION TO MANAGERS
      const checkUser = await UserModel.findOne({ where: { id } });
      const description = `${checkUser.full_name} telah membuat divisi dengan nama ${data.name}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      return res.status(200).json(response(true, 'Berhasil membuat divisi'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getDivisionDetail: async (req, res) => {
    const { division_id } = req.params;
    try {
      const division = await Divisions.findOne({
        where: { id: division_id },
        include: [
          {
            model: DivisionDetails,
            include: {
              model: EmployeeModel,
              attributes: ['id'],
              where: { active: 1 },
              include: [
                { model: UserModel, attributes: ['full_name', 'id'] },
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
            }
          },
          { model: CompanyModel, attributes: ['id', 'company_name', 'name'] }
        ]
      });
      if (division.length === 0) {
        return res.status(400).json(response(false, 'Gagal membuat detail divisi'));
      }
      let composeMember = [];
      let composeLeader = [];
      division.division_details.forEach(value => {
        if (!value.leadership) {
          const obj = {
            id: value.employee_id,
            fullName: value.employee.user.full_name,
            avatar: value.employee.assets
          };
          composeMember.push(obj);
        } else {
          const obj = {
            id: value.employee_id,
            fullName: value.employee.user.full_name,
            avatar: value.employee.assets
          };
          composeLeader.push(obj);
        }
      });
      const payload = {
        id: division.id,
        name: division.name,
        member: composeMember,
        leader: composeLeader,
        company: division.company
      };

      return res.status(200).json(response(true, 'Berhasil memuat detail divisi', payload));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  deleteDivision: async (req, res) => {
    const { division_id } = req.params;
    const { id, employeeId } = res.local.users;
    try {
      const division = await Divisions.findOne({ where: { id: division_id } });
      if (!division) {
        return res.status(400).json(response(false, 'Divisi tidak ditemukan'));
      }
      const deleteDivision = await Divisions.destroy({ where: { id: division_id } });
      if (deleteDivision === 0) {
        return res.status(400).json(response(false, 'Divisi gagal dihapus'));
      }
      // SEND NOTIFICATION TO MANAGERS
      const checkUser = await UserModel.findOne({ where: { id } });
      const description = `${checkUser.full_name} telah menghapus divisi dengan nama ${division.name}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      return res.status(200).json(response(true, 'Divisi berhasil dihapus'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  editDivision: async (req, res) => {
    const { division_id } = req.params;
    const { data } = req.body;
    const { id, employeeId } = res.local.users;
    try {
      const division = await Divisions.findOne({ where: { id: division_id } });
      if (!division) {
        return res.status(400).json(response(false, 'Divisi tidak ditemukan'));
      }
      await Divisions.update(
        { name: data.name, company_id: data.company_id },
        { where: { id: division_id } }
      );
      await DivisionDetails.destroy({ where: { division_id } });
      let payload = [];
      let memberArray = data.member;
      memberArray.forEach(value => {
        payload.push({ employee_id: value.id, division_id, leadership: 0 });
      });
      if (data.leader.length) {
        payload.push({
          employee_id: data.leader[0].id,
          division_id,
          leadership: 1
        });
      }
      const createDivisionDetail = await DivisionDetails.bulkCreate(payload);
      if (!createDivisionDetail) {
        return res.status(400).json(response(false, 'Gagal mengedit divisi'));
      }
      // SEND NOTIFICATION TO MANAGERS
      const checkUser = await UserModel.findOne({ where: { id } });
      const description = `${checkUser.full_name} telah mengedit divisi dengan nama ${division.name}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId,
        description
      });
      return res.status(200).json(response(true, 'Berhasil mengedit divisi'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = divisionsService;

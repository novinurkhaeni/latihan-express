require('module-alias/register');
const {
  Sequelize: { Op }
} = require('sequelize');
const crypt = require('bcrypt');
const { response, nodemailerMail, mailTemplates } = require('@helpers');
const {
  sequelize,
  companies: Company,
  employees: Employee,
  employee_pph21: EmployeePph21,
  salary_details: SalaryDetails,
  users: User,
  digital_assets: DigitalAsset,
  division_details: DivisionDetail,
  divisions: Division
} = require('@models');

const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

class Member {
  constructor(req, res) {
    this.req = req;
    this.res = res;
  }

  async createMember() {
    const { data } = this.req.body;
    const { company_id } = this.req.params;
    const { id, employeeId } = this.res.local.users;
    const res = this.res;
    const transaction = await sequelize.transaction();
    try {
      const userData = await User.findOne({
        where: { id }
      });
      const companyData = await Company.findOne({ where: { id: company_id } });
      if (!companyData) {
        return this.res
          .status(400)
          .json(response(false, `Company with parameter id ${company_id} not found`));
      }
      const emailExist = await User.findOne({
        where: { email: data.email }
      });
      if (emailExist) {
        const employeePayload = {
          company_id,
          user_id: emailExist.id,
          role: data.role,
          salary_type: data.salary_type,
          flag: 1,
          active: 1,
          date_start_work: data.date_start_work,
          date_end_work: data.date_end_work
        };
        let employee = await Employee.findOne({
          where: { user_id: emailExist.id }
        });
        let employeePph21Payload = {};
        Object.assign(employeePph21Payload, data.pph21);
        if (!employee) {
          employee = await Employee.create(employeePayload, { transaction });
          if (data.salary_id) {
            const salaryDetailsPayload = {
              employee_id: employee.id,
              salary_id: data.salary_id
            };
            await SalaryDetails.create(salaryDetailsPayload, { transaction });
          }
          if (data.pph21) {
            employeePph21Payload.employee_id = employee.id;
            await EmployeePph21.create(employeePph21Payload, { transaction });
          }
        } else {
          if (employee.flag.toString() === '3') {
            return this.res
              .status(400)
              .json(response(false, 'Email terdaftar sudah masuk ke perusahaan'));
          }
          await Employee.update(
            employeePayload,
            { where: { user_id: emailExist.id } },
            { transaction }
          );
          if (data.salary_id) {
            await SalaryDetails.update(
              { salary_id: data.salary_id },
              { where: { employee_id: employee.id } },
              { transaction }
            );
          }
          if (data.pph21)
            await EmployeePph21.update(
              employeePph21Payload,
              {
                where: { employee_id: employee.id }
              },
              { transaction }
            );
          else
            await EmployeePph21.destroy({ where: { employee_id: employee.id } }, { transaction });
        }
        // SEND NOTIFICATION TO MANAGERS
        const description = `${userData.full_name} telah mengundang seorang anggota baru bernama ${data.name}`;
        observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
          employeeId,
          description
        });
        /* eslint-disable indent */
        nodemailerMail.sendMail(
          {
            from: 'cs@atenda.id',
            to: emailExist.email, // An array if you have multiple recipients.
            subject: `Undangan Anggota ${companyData.name} - GajianDulu`,
            //You can use "html:" to send HTML email content. It's magic!
            html: mailTemplates.managerInviting({ companyData, data })
          },
          async function(err, info) {
            if (err) {
              let errorLog = new Date().toISOString() + ' [Manager Inviting]: ' + err + '\n';
              global.emailErrorLog.write(errorLog);
              return res
                .status(400)
                .json(response(false, 'Failed to send email, please invite member again', err));
            } else {
              await transaction.commit();
              return res.status(201).json(response(true, 'Calon member telah berhasil diundang'));
            }
          }
        );
        /* eslint-enable */
      } else {
        const hash = crypt.hashSync(new Date().toString() + data.email, 10);
        const payloadUser = Object.assign(
          {},
          { full_name: data.name, email: data.email, phone: data.phone, hash }
        );
        const userCreated = await User.create(payloadUser, { transaction });

        const payloadEmployee = Object.assign(
          {},
          {
            company_id,
            user_id: userCreated.id,
            salary_type: data.salary_type,
            role: data.role,
            flag: 1,
            date_start_work: data.date_start_work,
            date_end_work: data.date_end_work
          }
        );
        const employee = await Employee.create(payloadEmployee, { transaction });

        if (data.salary_id) {
          const salaryDetailsPayload = {
            employee_id: employee.id,
            salary_id: data.salary_id
          };

          await SalaryDetails.create(salaryDetailsPayload, { transaction });
        }
        let employeePph21Payload = {};
        Object.assign(employeePph21Payload, data.pph21);
        if (data.pph21) {
          employeePph21Payload.employee_id = employee.id;
          await EmployeePph21.create(employeePph21Payload, { transaction });
        }
        // SEND NOTIFICATION TO MANAGERS
        const description = `${userData.full_name} telah mengundang seorang anggota baru bernama ${data.name}`;
        observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
          employeeId,
          description
        });
        /* eslint-disable indent */
        nodemailerMail.sendMail(
          {
            from: 'cs@atenda.id',
            to: data.email, // An array if you have multiple recipients.
            subject: `Member Invitation GajianDulu - ${companyData.name}`,
            //You can use "html:" to send HTML email content. It's magic!
            html: mailTemplates.managerInviting({ companyData, data })
          },
          async function(err, info) {
            if (err) {
              let errorLog = new Date().toISOString() + ' [Member Invited]: ' + err + '\n';
              global.emailErrorLog.write(errorLog);
              return res
                .status(400)
                .json(response(false, 'Failed to send email, please invite member again', err));
            } else {
              await transaction.commit();
              return res
                .status(201)
                .json(response(true, 'User telah dibuat dan Member telah berhasil diundang'));
            }
          }
        );
      }
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }

  async getHrd() {
    const { company_ids } = this.req.params;
    const companyIds = company_ids.split(',');
    try {
      const employees = await Employee.findAll({
        where: { company_id: companyIds, role: 5, active: 1 },
        attributes: ['id'],
        include: [
          {
            model: DigitalAsset,
            required: false,
            attributes: ['url', 'type'],
            where: {
              type: 'avatar'
            },
            as: 'assets'
          },
          {
            model: User,
            attributes: ['full_name'],
            required: false
          }
        ]
      });
      const responses = [];
      for (const employee of employees) {
        responses.push({
          id: employee.id,
          full_name: employee.user.full_name,
          avatar: employee.assets
        });
      }
      return this.res.status(200).json(response(true, 'Berhasil mendapatkan data HRD', responses));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }

  async getMembers() {
    const { company_ids } = this.req.params;
    try {
      const employees = await Employee.findAll({
        where: { company_id: company_ids, active: 1, flag: 3, role: { [Op.ne]: 1 } },
        attributes: ['id'],
        include: [
          {
            model: DigitalAsset,
            required: false,
            attributes: ['url', 'type'],
            where: {
              type: 'avatar'
            },
            as: 'assets'
          },
          { model: User, attributes: ['full_name'] },
          { model: DivisionDetail, include: { model: Division } }
        ]
      });
      const divisions = [];
      for (const employee of employees) {
        for (const division of employee.division_details) {
          const divisionIndex = divisions.findIndex(
            val => val.division_id === division.division_id
          );
          if (divisionIndex !== -1) {
            const membersTemp = [...divisions[divisionIndex].members];
            membersTemp.push({
              user_id: employee.id,
              division_id: division.division_id,
              full_name: employee.user.full_name,
              avatar: employee.assets.length ? employee.assets[0].url : null
            });
            divisions[divisionIndex].members = membersTemp;
          } else {
            divisions.push({
              name: division.division.name,
              division_id: division.division_id,
              members: [
                {
                  user_id: employee.id,
                  division_id: division.division_id,
                  full_name: employee.user.full_name,
                  avatar: employee.assets.length ? employee.assets[0].url : null
                }
              ]
            });
          }
        }
      }

      const general = employees.map(val => ({
        user_id: val.id,
        full_name: val.user.full_name,
        avatar: val.assets.length ? val.assets[0].url : null
      }));

      const responses = {
        divisions,
        general
      };

      return this.res
        .status(200)
        .json(response(true, 'Berhasil mendapatkan daftar anggota', responses));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }

  async getMembersForDivision() {
    const { company_ids } = this.req.params;
    const { divisionId } = this.req.query;
    const companyIds = company_ids.split(',');
    try {
      // Get Members ID of Selected Branch
      const members = await Employee.findAll({
        where: { company_id: company_ids, active: 1 },
        attributes: ['id']
      });
      // Get Members ID that Already on a Division in Selected Branch
      const memberDivisions = await DivisionDetail.findAll({
        attributes: ['employee_id'],
        include: {
          model: Employee,
          where: { company_id: companyIds },
          required: true,
          attributes: []
        }
      });
      // Get Members ID that Already Assigned as HRD
      const memberHrds = await Employee.findAll({
        where: { company_id: companyIds, active: 1, role: 5 }
      });
      // Filtered Member
      const filteredMemberIds = memberDivisions
        .map(val => val.employee_id)
        .concat(memberHrds.map(val => val.id));
      // Get Members ID with Given Division ID (EDIT MODE)
      let membersDivision = [];
      if (divisionId) {
        membersDivision = await DivisionDetail.findAll({ where: { division_id: divisionId } });
      }
      let memberIds = [];
      for (const memberId of members) {
        const find = filteredMemberIds.find(val => val == memberId.id);
        if (!find) {
          memberIds.push(memberId.id);
        }
      }
      membersDivision = membersDivision.map(val => val.employee_id);
      memberIds = memberIds.concat(membersDivision);

      // Get Member Lists
      const memberLists = await Employee.findAll({
        where: { id: memberIds },
        attributes: ['id', 'flag', 'role'],
        include: [
          { model: User, attributes: ['full_name', 'email', 'phone'] },
          {
            model: DigitalAsset,
            attributes: ['url'],
            required: false,
            where: { type: 'avatar' },
            as: 'assets'
          },
          { model: Company, attributes: ['id', 'name', 'company_name'] }
        ]
      });
      const responses = memberLists.map(val => ({
        id: val.id,
        full_name: val.user.full_name,
        email: val.user.email,
        phone: val.user.phone,
        flag: val.flag,
        role: val.role,
        assets: val.assets,
        company: val.company
      }));
      return this.res
        .status(200)
        .json(response(true, 'Berhasil mendapatkan daftar anggota untuk divisi', responses));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
}

module.exports = Member;

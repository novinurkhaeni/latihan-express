require('module-alias/register');
const {
  response,
  definedSchedules: definedSchedulesHelper,
  scheduleTemplates: scheduleTemplatesHelper,
  dayDiff,
  formatCurrency,
  encrypt,
  nodemailerMail,
  mailTemplates
} = require('@helpers');
const {
  Sequelize,
  sequelize,
  digital_assets: DigitalAsset,
  submissions: SubmissionsModel,
  employees: EmployeeModel,
  users: UserModel,
  companies: CompanyModel,
  salary_details: SalaryDetailModel,
  employee_pph21: EmployeePph21Model
} = require('@models');
const { Op } = Sequelize;
const config = require('config');
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const membersService = {
  createLeaveAmountSubmission: async (req, res) => {
    const { data } = req.body;
    const { id: employeeId } = req.params;
    const { companyParentId, id } = res.local.users;
    try {
      //If given payload has same employeeId and type = 6
      let submission = await SubmissionsModel.findOne({
        where: { employee_id: employeeId, type: 6, status: 0 }
      });

      const submissionPayload = Object.assign({
        employee_id: employeeId,
        type: 6,
        amount: data.amount,
        status: 0,
        note: data.note
      });

      if (submission) {
        const submissionUpdate = await SubmissionsModel.update(submissionPayload, {
          where: {
            employee_id: employeeId,
            type: 6
          },
          returning: true
        });
        if (!submissionUpdate)
          return res.status(400).json(response(false, 'Pengajuan penambahan jatah cuti gagal'));
      } else {
        const submissionCreate = await SubmissionsModel.create(submissionPayload);
        if (!submissionCreate)
          return res.status(400).json(response(false, 'Pengajuan penambahan jatah cuti gagal'));
      }
      // Send Notification
      const user = await UserModel.findOne({ where: { id }, attributes: ['full_name'] });
      observe.emit(EVENT.SUBMISSION_CREATION, {
        parentCompanyId: companyParentId,
        message: {
          title: 'Pengajuan Tambah Jatah Cuti',
          body: `${user.full_name} telah mengajukan tambah jatah cuti sebanyak ${data.amount} hari`
        },
        ability: 'SUBMISSION_LEAVE_AMOUNT'
      });
      return res
        .status(201)
        .json(response(true, 'Pengajuan penambahan jatah cuti berhasil dilakukan'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  createLeaveSubmission: async (req, res) => {
    const { employee_id: employeeId } = req.params;
    const { companyParentId, id } = res.local.users;
    const transaction = await sequelize.transaction();
    try {
      const employeeLeave = await EmployeeModel.findOne({
        where: { id: employeeId },
        attributes: ['leave']
      });
      if (!employeeLeave) {
        return res.status(400).json(response(false, 'Anggota tidak ditemukan'));
      }

      const host =
        process.env.NODE_ENV !== 'production'
          ? `http://${config.host}:${config.port}/`
          : `https://${config.host}/`;

      const submissionPayload = {
        employee_id: employeeId,
        type: req.body.type,
        presence_type: req.body.presence_type,
        start_date: req.body.start_date,
        end_date: req.body.end_date,
        note: req.body.note,
        status: 0
      };

      let digitalAssetPayload = {
        type: 'leave',
        uploadable_type: 'submissions'
      };

      if (req.file) {
        // Handle Photo
        const filepath = req.file.path.split('/')[1];
        digitalAssetPayload['path'] = req.file.path;
        digitalAssetPayload['filename'] = req.file.filename;
        digitalAssetPayload['mime_type'] = req.file.mimetype;
        digitalAssetPayload['url'] = `${host}${filepath}/${req.file.filename}`;
      }

      const leaveDays = dayDiff(req.body.start_date, req.body.end_date) + 1;
      if (leaveDays > employeeLeave.leave) {
        return res
          .status(400)
          .json(response(false, 'Jumlah hari untuk mengajuakan cuti/izin telah habis'));
      }
      const submissionCreate = await SubmissionsModel.create(submissionPayload, {
        transaction
      });
      if (!submissionCreate) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Pengajuan cuti/izin gagal diproses'));
      }

      // Update Leave Amount
      if (req.body.presence_type == 1) {
        const restLeaveAllowance = parseInt(employeeLeave.leave) - parseInt(leaveDays);
        const updateEmployee = await EmployeeModel.update(
          { leave: restLeaveAllowance },
          { where: { id: employeeId }, transaction }
        );
        if (!updateEmployee) {
          await transaction.rollback();
          return res.status(400).json(response(false, 'Pengajuan cuti/izin gagal diproses'));
        }
      }

      if (req.file) {
        digitalAssetPayload['uploadable_id'] = submissionCreate.id;
        const photo = await DigitalAsset.create(digitalAssetPayload, { transaction });
        if (!photo) {
          await transaction.rollback();
          return res.status(400).json(response(false, 'Pengajuan cuti/izin gagal diproses'));
        }
      }
      await transaction.commit();

      // Send Notification
      const user = await UserModel.findOne({ where: { id }, attributes: ['full_name'] });
      observe.emit(EVENT.SUBMISSION_CREATION, {
        parentCompanyId: companyParentId,
        message: {
          title: `Pengajuan ${req.body.presence_type == 1 ? 'Cuti' : 'Izin'}`,
          body: `${user.full_name} telah mengajukan ${
            req.body.presence_type == 1 ? 'cuti' : 'izin'
          } mulai dari tanggal ${req.body.start_date} s/d ${req.body.end_date}`
        },
        ability: 'SUBMISSION_LEAVE'
      });
      return res.status(201).json(response(true, 'Pengajuan izin/cuti berhasil dilakukan'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  createBonusSubmission: async (req, res) => {
    const { employee_id: employeeId } = req.params;
    const { companyParentId, id } = res.local.users;
    const { data } = req.body;
    try {
      const submissionPayload = {
        employee_id: employeeId,
        type: 5,
        amount: data.amount,
        status: 0,
        note: data.note
      };

      try {
        const checkEmployee = await EmployeeModel.findOne({ where: { id: employeeId } });
        if (!checkEmployee) {
          return res.status(400).json(response(false, 'Anggota tidak ditemukan'));
        }
        const submissionCreate = await SubmissionsModel.create(submissionPayload);
        if (!submissionCreate) {
          return res.status(400).json(response(false, 'Pengajuan bonus gagal diproses'));
        }
      } catch (error) {
        if (error) {
          if (error.errors) {
            return res.status(400).json(response(false, error.errors));
          }
          return res.status(400).json(response(false, error.message));
        }
      }
      // Send Notification
      const user = await UserModel.findOne({ where: { id }, attributes: ['full_name'] });
      observe.emit(EVENT.SUBMISSION_CREATION, {
        parentCompanyId: companyParentId,
        message: {
          title: 'Pengajuan Bonus',
          body: `${user.full_name} telah mengajukan bonus senilai Rp ${formatCurrency(
            parseInt(data.amount)
          )}`
        },
        ability: 'SUBMISSION_BONUS'
      });
      return res.status(201).json(response(true, 'Pengajuan bonus berhasil dilakukan'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  patchLeaveAmount: async (req, res) => {
    const { data } = req.body; // data === {leave: integer}
    const { employeeId } = req.params;

    try {
      let employee = await EmployeeModel.findOne({
        where: { id: employeeId }
      });

      if (!employee) {
        return res.status(400).json(response(false, 'Member tidak ditemukan'));
      }

      const leaveAmountUpdate = await EmployeeModel.update(data, {
        where: {
          id: employeeId
        },
        returning: true
      });

      if (!leaveAmountUpdate) {
        return res.status(400).json(response(false, 'Data jatah cuti anggota gagal diubah'));
      }

      return res.status(200).json(response(true, 'Data jatah cuti anggota berhasil diubah'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  getBulkSchedule: async (req, res) => {
    const { employeeId } = req.params;
    const { date } = req.query;
    try {
      const employee = await EmployeeModel.findOne({
        where: { id: employeeId },
        attributes: ['company_id', 'id']
      });

      if (!employee) {
        return res.status(400).json(response(false, 'Member tidak ditemukan'));
      }

      const scheduleDatas = [];
      // collect data from scheduleTemplate
      let schedules = [];
      schedules = await scheduleTemplatesHelper(date, employee.id, employee.company_id, true);

      for (const schedule of schedules) {
        if (schedule.shift) {
          const compose = { ...schedule };
          Object.assign(compose.dataValues, { date });
          scheduleDatas.push(compose);
        }
      }

      // collect data from definedSchedule
      schedules = [];
      schedules = await definedSchedulesHelper(
        date,
        employee.company_id,
        employee.id,
        null,
        false,
        false,
        true
      );
      for (const schedule of schedules) {
        if (schedule.shift) {
          const compose = { ...schedule };
          Object.assign(compose.dataValues, { date });
          scheduleDatas.push(compose);
        }
      }
      let responses = [];
      for (const scheduleData of scheduleDatas) {
        const compose = {
          defined_schedule_id:
            scheduleData.shift.schedule_type === 'defined_schedules'
              ? scheduleData.shift.schedule_id
              : null,
          schedule_template_id:
            scheduleData.shift.schedule_type === 'schedule_templates'
              ? scheduleData.shift.schedule_id
              : null,
          employee_id: scheduleData.employee.id,
          date: scheduleData.dataValues.date,
          full_name: scheduleData.employee.user.full_name,
          shift_name: scheduleData.shift.schedule_shift.shift_name,
          color: scheduleData.shift.schedule_shift.color,
          start_time: scheduleData.shift.schedule_shift.start_time,
          end_time: scheduleData.shift.schedule_shift.end_time,
          use_salary_per_shift: scheduleData.shift.schedule_shift.use_salary_per_shift,
          salary_group: scheduleData.shift.schedule_shift.salary_group,
          branch: scheduleData.company.name || scheduleData.company.company_name
        };
        responses.push(compose);
      }

      return res.status(200).json(response(true, 'Data jadwal berhasil didapatkan', responses));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  updateMembersRoles: async (req, res) => {
    const { data } = req.body;
    const transaction = await sequelize.transaction();
    try {
      const updateToManager = await EmployeeModel.update(
        { role: 3 },
        { where: { id: { [Op.in]: data.managers } }, transaction }
      );
      if (!updateToManager) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Data peran anggota gagal diubah'));
      }
      const updateToSupervisor = await EmployeeModel.update(
        { role: 4 },
        { where: { id: { [Op.in]: data.supervisors } }, transaction }
      );
      if (!updateToSupervisor) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Data peran anggota gagal diubah'));
      }
      await transaction.commit();
      return res.status(200).json(response(true, 'Data peran anggota berhasil diubah'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  respondMember: async (req, res) => {
    const { employee_id } = req.params;
    const { data } = req.body;
    const transaction = await sequelize.transaction();
    try {
      const employee = await EmployeeModel.findOne({
        where: { id: employee_id },
        include: [
          { model: UserModel, attributes: ['id'] },
          { model: CompanyModel, attributes: ['id'] }
        ]
      });
      if (!employee) {
        return res.status(400).json(response(false, 'Member tidak ditemukan'));
      }
      if (data.salary_id) {
        const salaryDetailsPayload = {
          employee_id,
          salary_id: data.salary_id
        };
        const createSalaryDetail = await SalaryDetailModel.create(salaryDetailsPayload, {
          transaction
        });
        if (!createSalaryDetail) {
          await transaction.rollback();
          return res.status(400).json(response(false, 'Gagal merespon karyawan'));
        }
      }
      const employeePayload = {
        salary_type: data.salary_type,
        role: 2,
        flag: 3,
        date_start_work: data.years_of_service,
        date_end_work: data.years_of_service,
        active: 1,
        leave: 12
      };
      const updateEmployee = await EmployeeModel.update(employeePayload, {
        where: { id: employee_id },
        transaction
      });
      if (!updateEmployee) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal merespon karyawan'));
      }

      if (data.pph21) {
        const createPph21 = await EmployeePph21Model.create(
          { ...data.pph21, employee_id },
          { transaction }
        );
        if (!createPph21) {
          await transaction.rollback();
          return res.status(400).json(response(false, 'Gagal merespon karyawan'));
        }
      }

      observe.emit(EVENT.MEMBER_APPROVED, {
        companyId: employee.company.id,
        employeeId: employee_id
      });

      observe.emit(EVENT.NEW_EMPLOYEE_JOINED, {
        userId: employee.user.id,
        employeeId: employee.id,
        companyId: employee.company.id
      });
      await transaction.commit();
      return res.status(200).json(response(true, 'Member berhasil bergabung'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  editMember: async (req, res) => {
    const { data } = req.body;
    const { employee_id: employeeId } = req.params;
    const { id, employeeId: currentEmployeeId } = res.local.users;
    const transaction = await sequelize.transaction();
    let isCronActive = false;
    try {
      const employee = await EmployeeModel.findOne({
        where: { id: employeeId },
        include: [{ model: UserModel, attributes: ['id', 'full_name'] }]
      });
      if (!employee) {
        return res.status(400).json(response(false, 'Member tidak ditemukan'));
      }
      // User Data for Notification Reporting
      const userData = await UserModel.findOne({ where: { id } });
      // Check Owner Availability If Payload Has Role
      if (data.role) {
        //count role manager
        var countRole = await EmployeeModel.findAll({
          where: { role: { [Op.like]: 1 }, company_id: employee.company_id }
        });
        //condition for check total manager
        if (data.role != 1 && countRole.length == 1 && employeeId == countRole[0].id) {
          return res
            .status(400)
            .json(response(false, 'Minimal terdapat satu pemilik usaha dalam suatu tim'));
        }
      }
      let payload = {
        full_name: data.full_name,
        email: data.email,
        is_email_confirmed:
          data.email && currentEmployeeId == employeeId ? 0 : userData.is_email_confirmed
      };
      const editUser = await UserModel.update(payload, {
        where: { id: employee.user.id },
        transaction
      });
      if (!editUser) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal mengubah data member'));
      }
      // Send Verification Email if Email is Changed
      if (data.email && currentEmployeeId == employeeId) {
        const encryptedUserId = encrypt(id.toString());
        await nodemailerMail.sendMail({
          from: 'cs@atenda.id',
          to: data.email,
          subject: `Atenda: Verifikasi Email`,
          html: mailTemplates.emailVerification({
            fullName: userData.full_name,
            url: `https://${config.host}/api/v4/verify?code=${encryptedUserId}`
          })
        });
      }

      // Employee
      let employeePayload = {};
      if (data.role) employeePayload.role = data.role;
      if (data.salary_type) employeePayload.salary_type = data.salary_type;
      if (data.company_id) employeePayload.company_id = data.company_id;
      if (data.years_of_service) {
        employeePayload.date_start_work = data.years_of_service;
        employeePayload.date_end_work = data.years_of_service;
      }
      if (Object.keys(employeePayload).length) {
        const editEmployee = await EmployeeModel.update(employeePayload, {
          where: { id: employeeId },
          transaction
        });
        if (!editEmployee) {
          await transaction.rollback();
          return res.status(400).json(response(false, 'Gagal mengubah data member'));
        }
      }

      const isPph21Exist = await EmployeePph21Model.findOne({ where: { employee_id: employeeId } });
      if (data.pph21 && isPph21Exist) {
        await EmployeePph21Model.update(data.pph21, {
          where: { employee_id: employeeId },
          transaction
        });
      } else if (data.pph21 && !isPph21Exist) {
        await EmployeePph21Model.create(
          { ...data.pph21, employee_id: employeeId },
          { transaction }
        );
      }
      if (!data.pph21 && isPph21Exist) {
        await EmployeePph21Model.destroy({ where: { employee_id: employeeId } }, { transaction });
      }
      const getEmployee = await EmployeeModel.findOne({
        where: { id: employeeId },
        attributes: ['id'],
        include: { model: UserModel }
      });
      const respondPayload = {
        user_id: getEmployee.user.id,
        full_name: getEmployee.user.full_name,
        email: getEmployee.user.email,
        phone: getEmployee.user.phone
      };
      // SEND NOTIFICATION TO MANAGERS
      const description = `${userData.full_name} telah mengedit data anggota ${employee.user.full_name}`;
      observe.emit(EVENT.USER_ACTIVITY_NOTIF, {
        employeeId: currentEmployeeId,
        description
      });
      await transaction.commit();
      let responses = {
        message: 'Data member berhasil diubah',
        useAlert: false
      };
      if (isCronActive) {
        responses = {
          message:
            'Data member berhasil diubah. Perubahan data seperti golongan gaji atau lokasi tim akan diterapkan pada saat periode baru dimulai (tanggal buka buku)',
          useAlert: true
        };
      }
      return res
        .status(201)
        .json(response(true, responses.message, respondPayload, { useAlert: responses.useAlert }));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  editPhone: async (req, res) => {
    const { data } = req.body;
    const { employee_id } = req.params;
    try {
      const employee = await EmployeeModel.findOne({
        where: { id: employee_id },
        attributes: ['user_id']
      });

      if (!employee) {
        return res.status(400).json(response(true, 'user tidak di temukan'));
      }
      await UserModel.update({ phone: data.phone }, { where: { id: employee.user_id } });
      const responses = {
        phone: data.phone
      };
      return res.status(200).json(response(true, 'nomor telephone berhasil diubah', responses));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  updateDemo: async (req, res) => {
    const { employee_id } = req.params;
    const { data } = req.body;
    try {
      const checkMember = await EmployeeModel.findOne({
        where: { id: employee_id },
        include: { model: UserModel, attributes: ['id'] }
      });
      if (!checkMember) {
        return res.status(400).json(response(false, 'Member tidak ditemukan'));
      }
      const updateMember = await UserModel.update(data, { where: { id: checkMember.user.id } });
      if (!updateMember) {
        return res.status(400).json(response(false, 'Data member gagal diubah'));
      }
      return res.status(200).json(response(true, 'Data member berhasil diubah'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  reject: async (req, res) => {
    const { employee_id } = req.params;
    const { employeeId } = res.local.users;
    try {
      const employee = await EmployeeModel.findOne({ where: { id: employee_id } });
      if (!employee) {
        return res.status(400).json(response(false, 'Member tidak ditemukan'));
      }
      const deleteEmployee = await EmployeeModel.destroy({ where: { id: employee_id } });
      if (!deleteEmployee) {
        return res.status(400).json(response(false, 'Gagal menolak member'));
      }

      // Send Notification
      const currentEmployee = await EmployeeModel.findOne({
        where: { id: employeeId },
        include: { model: CompanyModel, attributes: ['company_name', 'name'] }
      });

      observe.emit(EVENT.REJECT_MEMBER, {
        employeeId: employee_id,
        companyName: currentEmployee.company.company_name || currentEmployee.company.name
      });

      return res.status(200).json(response(false, 'Member berhasil ditolak'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  setToHrd: async (req, res) => {
    const { employee_ids } = req.params;
    const employeeIds = employee_ids.split(',');
    try {
      const updateEmployee = await EmployeeModel.update(
        { role: 5 },
        { where: { id: employeeIds } }
      );
      if (!updateEmployee) {
        return res.status(400).json(response(false, 'Gagal mengubah peran anggota'));
      }
      return res.status(200).json(response(false, 'Berhasil mengubah peran anggota menjadi HRD'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = membersService;

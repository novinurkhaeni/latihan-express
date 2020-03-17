require('module-alias/register');
const { response } = require('@helpers');
const {
  Sequelize,
  sequelize,
  submissions: SubmissionsModel,
  employees: EmployeesModel,
  users: UserModel,
  digital_assets: DigitalAsset,
  journals: JournalModel,
  presences: PresenceModel,
  schedule_templates: ScheduleTemplate,
  defined_schedules: DefinedSchedule,
  schedule_shift_details: ScheduleShiftDetail,
  schedule_notes: ScheduleNote,
  schedule_swaps: ScheduleSwap,
  schedule_swap_details: ScheduleSwapDetail,
  companies: Company,
  schedule_submissions: ScheduleSubmission,
  employee_notes: EmployeeNote
} = require('@models');
const { Op } = Sequelize;
const { formatCurrency, dateConverter, dayDiff } = require('@helpers');
const config = require('config');
const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');
const { presenceService } = require('@services/v2.1');

const companiesService = {
  getLeaveSubmissionDetail: async (req, res) => {
    const { submissionId } = req.params;
    try {
      const submission = await SubmissionsModel.findOne({
        where: { id: submissionId },
        attributes: ['id', 'employee_id', 'start_date', 'end_date', 'note', 'presence_type'],
        include: [
          {
            model: EmployeesModel,
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
              }
            ]
          },
          {
            model: DigitalAsset,
            attributes: ['url', 'filename'],
            required: false,
            where: {
              type: 'leave'
            },
            as: 'assets'
          }
        ]
      });
      let description = 'Cuti';
      if (submission.presence_type == 2) description = 'Izin';
      const data = {
        id: submission.id,
        employee_id: submission.employee_id,
        full_name: submission.employee.user.full_name,
        start_date: submission.start_date,
        end_date: submission.end_date,
        note: submission.note,
        presence_type: submission.presence_type,
        description,
        leave_remaining: submission.employee.leave,
        avatar: submission.employee.assets.length
          ? submission.employee.assets[0].dataValues.url
          : null,
        /* eslint-disable */
        photo: submission.assets.length
          ? [
              {
                uri: submission.assets[0].dataValues.url,
                name: submission.assets[0].dataValues.filename
              }
            ]
          : null
      };

      return res
        .status(200)
        .json(response(true, 'Data detail pengajuan presensi berhasil didapatkan', data));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getLeaveAmountSubmissionDetail: async (req, res) => {
    const { submissionId } = req.params;
    try {
      const submission = await SubmissionsModel.findOne({
        where: { id: submissionId },
        include: {
          model: EmployeesModel,
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
            }
          ]
        }
      });
      if (!submission)
        return res.status(400).json(response(false, 'Data pengajuan jatah cuti tidak ditemukan'));

      const data = {
        id: submission.id,
        employee_id: submission.employee_id,
        type: submission.type,
        full_name: submission.employee.user.full_name,
        avatar: submission.employee.assets.length
          ? submission.employee.assets[0].dataValues.url
          : null,
        leave_remaining: submission.employee.leave,
        note: submission.note,
        amount: submission.amount
      };

      return res
        .status(200)
        .json(response(true, 'Data detail pengajuan presensi berhasil didapatkan', data));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  editLeaveSubmission: async (req, res) => {
    const { submissionId } = req.params;
    const host =
      process.env.NODE_ENV !== 'production'
        ? `http://${config.host}:${config.port}/`
        : `https://${config.host}/`;
    try {
      const submission = await SubmissionsModel.findOne({ where: { id: submissionId } });
      if (!submission) {
        return res.status(400).json(response(false, 'Data pengajuan cuti/izin tidak ditemukan'));
      }
      const submissionPayload = {
        presence_type: req.body.presence_type,
        start_date: req.body.start_date,
        end_date: req.body.end_date,
        note: req.body.note,
        status: req.body.status
      };
      const transaction = await sequelize.transaction();
      // Begin Transaction
      try {
        const updateSubmission = await SubmissionsModel.update(submissionPayload, {
          where: { id: submissionId },
          transaction
        });
        if (!updateSubmission) {
          await transaction.rollback();
          return res.status(400).json(response(false, 'Data pengajuan cuti/izin gagal diubah'));
        }
        // Also Update Photo if User Change It
        if (req.file) {
          let digitalAssetPayload = {
            type: 'leave',
            uploadable_type: 'submissions'
          };
          // Handle Photo
          const filepath = req.file.path.split('/')[1];
          digitalAssetPayload['path'] = req.file.path;
          digitalAssetPayload['filename'] = req.file.filename;
          digitalAssetPayload['mime_type'] = req.file.mimetype;
          digitalAssetPayload['url'] = `${host}${filepath}/${req.file.filename}`;

          const updatePhoto = await DigitalAsset.update(digitalAssetPayload, {
            where: { uploadable_id: submissionId, type: 'leave' },
            transaction
          });
          if (!updatePhoto) {
            await transaction.rollback();
            return res.status(400).json(response(false, 'Data pengajuan cuti/izin gagal diubah'));
          }
        }
      } catch (error) {
        await transaction.rollback();
        if (error.errors) {
          return res.status(400).json(response(false, error.errors));
        }
        return res.status(400).json(response(false, error.message));
      }
      await transaction.commit();
      return res.status(200).json(response(true, 'Pengajuan izin/cuti berhasil diubah'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  abortLeaveSubmission: async (req, res) => {
    const { submissionId } = req.params;
    const { employeeId } = res.local.users;
    try {
      const submission = await SubmissionsModel.findOne({ where: { id: submissionId } });
      if (!submission) {
        return res.status(400).json(response(false, 'Data pengajuan jatah cuti tidak ditemukan'));
      }
      const deleteSubmission = await submission.destroy({ where: { id: submissionId } });
      if (!deleteSubmission) {
        return res.status(400).json(response(false, 'Data pengajuan jatah cuti gagal dibatalkan'));
      }
      // SEND NOTIFICATION
      const employee = await EmployeesModel.findOne({
        where: { id: employeeId },
        include: { model: UserModel, attributes: ['full_name'] }
      });
      const startDate = new Date(submission.start_date);
      const endDate = new Date(submission.end_date);
      const leaveDays = (endDate - startDate) / 24 / 60 / 60 / 1000;
      const title = 'Pembatalan Pengajuan Cuti/Izin';
      const description = `${employee.user.full_name} telah membatalkan pengajuan jatah cuti/izin sebanyak ${leaveDays} hari`;
      observe.emit(EVENT.SUBMISSION_ABORT, {
        employeeId,
        companyId: employee.company_id,
        title,
        description
      });
      return res.status(200).json(response(true, 'Data pengajuan cuti/izin berhasil dibatalkan'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  editLeaveAmountSubmission: async (req, res) => {
    const { submissionId } = req.params;
    const { data } = req.body;
    try {
      const submission = await SubmissionsModel.findOne({ where: { id: submissionId } });
      if (!submission) {
        return res.status(400).json(response(false, 'Data pengajuan jatah cuti tidak ditemukan'));
      }
      const updateSubmission = await SubmissionsModel.update(
        { amount: data.amount },
        { where: { id: submissionId } }
      );
      if (!updateSubmission) {
        return res.status(400).json(response(false, 'Data pengajuan jatah cuti gagal diubah'));
      }
      return res.status(200).json(response(true, 'Data pengajuan jatah cuti berhasil diubah'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  abortLeaveAmountSubmission: async (req, res) => {
    const { submissionId } = req.params;
    const { employeeId } = res.local.users;
    try {
      const submission = await SubmissionsModel.findOne({ where: { id: submissionId } });
      if (!submission) {
        return res.status(400).json(response(false, 'Data pengajuan jatah cuti tidak ditemukan'));
      }
      const deleteSubmission = await submission.destroy({ where: { id: submissionId } });
      if (!deleteSubmission) {
        return res.status(400).json(response(false, 'Data pengajuan jatah cuti gagal dibatalkan'));
      }
      // SEND NOTIFICATION
      const employee = await EmployeesModel.findOne({
        where: { id: employeeId },
        include: { model: UserModel, attributes: ['full_name'] }
      });
      const title = 'Pembatalan Pengajuan Jatah Cuti';
      const description = `${employee.user.full_name} telah membatalkan pengajuan jatah cuti sebanyak Rp. ${submission.amount} hari`;
      observe.emit(EVENT.SUBMISSION_ABORT, {
        employeeId,
        companyId: employee.company_id,
        title,
        description
      });
      return res.status(200).json(response(true, 'Data pengajuan jatah cuti berhasil dibatalkan'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getBonusSubmissionDetail: async (req, res) => {
    const { submissionId } = req.params;

    try {
      const submission = await SubmissionsModel.findOne({
        where: { id: submissionId },
        attributes: ['id', 'employee_id', 'type', 'date', 'note', 'amount'],
        include: [
          {
            model: EmployeesModel,
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
              }
            ]
          },
          {
            model: DigitalAsset,
            attributes: ['url', 'filename'],
            required: false,
            where: {
              type: 'bonus'
            },
            as: 'assets'
          }
        ]
      });

      const data = {
        id: submission.id,
        employee_id: submission.employee_id,
        full_name: submission.employee.user.full_name,
        type: submission.type,
        date: submission.date,
        note: submission.note,
        amount: submission.amount,
        avatar: submission.employee.assets.length
          ? submission.employee.assets[0].dataValues.url
          : null,
        /* eslint-disable */
        photo: submission.assets.length
          ? [
              {
                uri: submission.assets[0].dataValues.url,
                name: submission.assets[0].dataValues.filename
              }
            ]
          : null
      };

      return res
        .status(200)
        .json(response(true, 'Data pengajuan bonus/jatah cuti berhasil didapatkan', data));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  patchApprovalSubmission: async (req, res) => {
    const { submissionIds } = req.params;
    const { status } = req.query;
    const submissionId = submissionIds.split(',');
    const { employeeId: managerId } = res.local.users;

    try {
      const submissions = await SubmissionsModel.findAll({
        where: { id: { [Op.in]: submissionId } },
        include: [
          {
            model: EmployeesModel,
            attributes: ['leave']
          }
        ]
      });
      let tempSubmissionIds = [];
      const presenceIds = [];
      for (const submission of submissions) {
        tempSubmissionIds.push(submission.id.toString());
      }
      tempSubmissionIds = tempSubmissionIds.concat(submissionId);
      for (const ids of submissionId) {
        const filter = tempSubmissionIds.filter(val => val === ids);
        if (filter.length === 1) presenceIds.push(ids);
      }
      const checkPresenceSubmission = await PresenceModel.findAll({
        where: { id: presenceIds, custom_presence: 1 }
      });
      if (!submissions.length && !checkPresenceSubmission.length)
        return res.status(400).json(response(false, 'Data pengajuan tidak ditemukan'));

      // Find User Who do Approval
      const actor = await EmployeesModel.findOne({
        where: { id: managerId },
        attributes: ['id'],
        include: { model: UserModel, attributes: ['full_name'] }
      });

      const transaction = await sequelize.transaction();
      try {
        for (submission of submissions) {
          // ACTION FOR APRROVED SUBMISSION
          const employeeId = submission.employee_id;
          if (status === 'approved') {
            if (submission.type === 5) {
              const journalPayload = {
                employee_id: submission.employee_id,
                type: 'other',
                debet: submission.amount,
                kredit: 0,
                description: submission.note
              };
              const journalCreate = await JournalModel.create(journalPayload, { transaction });
              if (!journalCreate) {
                await transaction.rollback();
                return res.status(400).json(response(false, 'Gagal merespon Pengajuan'));
              }
              const createNote = await EmployeeNote.create(
                {
                  employee_id: submission.employee_id,
                  type: 1,
                  date: dateConverter(new Date()),
                  notes: submission.note,
                  amount: submission.amount
                },
                { transaction }
              );
              if (!createNote) {
                await transaction.rollback();
                return res.status(400).json(response(false, 'Gagal merespon Pengajuan'));
              }
              const updateSubmission = await SubmissionsModel.update(
                { status: 1 },
                {
                  where: { id: submission.id },
                  transaction
                }
              );
              if (!updateSubmission) {
                await transaction.rollback();
                return res.status(400).json(response(false, 'Gagal merespon Pengajuan'));
              }
              const title = 'Pengajuan bonus disetujui';
              const description = `Pengajuan bonus senilai Rp. ${formatCurrency(
                submission.amount
              )} telah disetujui ${actor.user.full_name}`;
              observe.emit(EVENT.SUBMISSION_APPROVAL, {
                employeeId,
                title,
                description
              });
            }

            if (submission.type === 6) {
              const leave = submission.employee.leave + submission.amount;
              const EmployeeUpdate = await EmployeesModel.update(
                { leave },
                {
                  where: {
                    id: submission.employee_id
                  },
                  returning: true,
                  transaction
                }
              );
              if (!EmployeeUpdate) {
                await transaction.rollback();
                return res.status(400).json(response(false, 'Gagal merespon Pengajuan'));
              }
              const updateSubmission = await SubmissionsModel.update(
                { status: 1 },
                {
                  where: { id: submission.id },
                  transaction
                }
              );
              if (!updateSubmission) {
                await transaction.rollback();
                return res.status(400).json(response(false, 'Gagal merespon Pengajuan'));
              }
              const title = 'Pengajuan penambahan jatah cuti disetujui';
              const description = `Pengajuan penambahan jatah cuti sebanyak ${submission.amount} hari telah disetujui ${actor.user.full_name}`;
              observe.emit(EVENT.SUBMISSION_APPROVAL, {
                employeeId,
                title,
                description
              });
            }

            if (submission.type === 2) {
              const presence_type = submission.presence_type;
              let type = '';
              switch (presence_type) {
                case 1:
                  type = 'leave';
                  break;
                case 2:
                  type = 'permit';
                  break;
                default:
                  type = null;
              }

              const findEmployees = await EmployeesModel.findOne({
                where: {
                  id: managerId
                }
              });

              if (!findEmployees) {
                return res.status(400).json(response(false, 'Gagal merespon Pengajuan'));
              }

              const managerCompanyId = findEmployees.company_id;

              const reqPayload = {
                body: {
                  data: {
                    member: [employeeId],
                    company_id: managerCompanyId,
                    presence_start: submission.start_date,
                    presence_end: submission.end_date,
                    notes: submission.note,
                    submission_id: submission.id
                  }
                },
                params: {
                  company_id: managerCompanyId
                },
                query: {
                  type
                }
              };

              const feedback = await presenceService.create(reqPayload, res, false);

              if (!feedback) {
                return res.status(400).json(response(false, 'Gagal merespon Pengajuan'));
              }
              const updateSubmission = await SubmissionsModel.update(
                { status: 1 },
                {
                  where: { id: submission.id },
                  transaction
                }
              );
              if (!updateSubmission) {
                await transaction.rollback();
                return res.status(400).json(response(false, 'Gagal merespon Pengajuan'));
              }

              const title = 'Pengajuan cuti/izin disetujui';
              const description = `Pengajuan cuti/izin sebanyak ${dayDiff(
                submission.start_date,
                submission.end_date
              ) + 1} hari telah disetujui ${actor.user.full_name}`;
              observe.emit(EVENT.SUBMISSION_APPROVAL, {
                employeeId,
                title,
                description
              });
            }
          }
          // ACTION FOR REJECTED SUBMISSION
          if (status === 'rejected') {
            if (submission.type === 5) {
              const updateSubmission = await SubmissionsModel.update(
                { status: -1 },
                {
                  where: { id: submission.id },
                  transaction
                }
              );
              if (!updateSubmission) {
                await transaction.rollback();
                return res.status(400).json(response(false, 'Gagal merespon Pengajuan'));
              }
              const title = 'Penolakan pengajuan bonus';
              const description = `Pengajuan bonus senilai Rp. ${formatCurrency(
                submission.amount
              )} telah ditolak ${actor.user.full_name}`;
              observe.emit(EVENT.SUBMISSION_APPROVAL, {
                employeeId,
                title,
                description
              });
            }

            if (submission.type === 6) {
              const updateSubmission = await SubmissionsModel.update(
                { status: -1 },
                {
                  where: { id: submission.id },
                  transaction
                }
              );
              if (!updateSubmission) {
                await transaction.rollback();
                return res.status(400).json(response(false, 'Gagal merespon Pengajuan'));
              }
              const title = 'Pengajuan penambahan jatah cuti ditolak';
              const description = `Pengajuan penambahan jatah cuti sebanyak ${submission.amount} hari telah ditolak ${actor.user.full_name}`;
              observe.emit(EVENT.SUBMISSION_APPROVAL, {
                employeeId,
                title,
                description
              });
            }

            if (submission.type === 2) {
              const updateSubmission = await SubmissionsModel.update(
                { status: -1 },
                {
                  where: { id: submission.id },
                  transaction
                }
              );
              if (!updateSubmission) {
                await transaction.rollback();
                return res.status(400).json(response(false, 'Gagal merespon Pengajuan'));
              }

              if (submission.presence_type == 1) {
                const leave =
                  submission.employee.leave +
                  (dayDiff(submission.start_date, submission.end_date) + 1);
                const updateEmployee = await EmployeesModel.update(
                  { leave },
                  { where: { id: submission.employee_id }, transaction }
                );

                if (!updateEmployee) {
                  await transaction.rollback();
                  return res.status(400).json(response(false, 'Gagal merespon Pengajuan'));
                }
              }

              const title = 'Pengajuan cuti/izin ditolak';
              const description = `Pengajuan cuti/izin sebanyak ${dayDiff(
                submission.start_date,
                submission.end_date
              ) + 1} hari telah ditolak ${actor.user.full_name}`;
              observe.emit(EVENT.SUBMISSION_APPROVAL, {
                employeeId,
                title,
                description
              });
            }
          }
        }
      } catch (err) {
        await transaction.rollback();
        if (error.errors) {
          return res.status(400).json(response(false, error.errors));
        }
        return res.status(400).json(response(false, error.message));
      }

      try {
        for (const presenceId of presenceIds) {
          const presence = await PresenceModel.findOne({ where: { id: presenceId } });
          if (!presence) {
            await transaction.rollback();
            return res.status(400).json(response(false, 'Data pengajuan tidak ditemukan'));
          }
          if (status === 'approved') {
            const updatePresence = await PresenceModel.update(
              { custom_presence: 0 },
              { where: { id: presenceId }, returning: true, transaction }
            );
            if (!updatePresence) {
              await transaction.rollback();
              return res.status(400).json(response(false, 'Gagal merespon Pengajuan'));
            }
            const updateJournal = await JournalModel.update(
              { on_hold: 0 },
              {
                where: [
                  Sequelize.where(
                    Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
                    presence.presence_date
                  ),
                  { employee_id: presence.employee_id }
                ]
              }
            );
            if (!updateJournal) {
              await transaction.rollback();
              return res.status(400).json(response(false, 'Gagal merespon Pengajuan'));
            }
            // SEND NOTIFICATION
            const title = 'Pengajuan ceklok lokasi lain disetujui';
            const description = `Pengajuan ceklok lokasi lain pada tanggal ${presence.presence_date} telah disetujui ${actor.user.full_name}`;
            observe.emit(EVENT.SUBMISSION_APPROVAL, {
              employeeId: presence.employee_id,
              title,
              description
            });
          }
          if (status === 'rejected') {
            const deletePresence = await PresenceModel.update(
              { custom_presence: -1 },
              { where: { id: presenceId } }
            );
            if (!deletePresence) {
              return res.status(400).json(response(false, 'Gagal merespon Pengajuan'));
            }
            // SEND NOTIFICATION
            const title = 'Pengajuan ceklok lokasi lain ditolak';
            const description = `Pengajuan ceklok lokasi lain pada tanggal ${presence.presence_date} telah ditolak ${actor.user.full_name}`;
            observe.emit(EVENT.SUBMISSION_APPROVAL, {
              employeeId: presence.employee_id,
              title,
              description
            });
          }
        }
      } catch (error) {
        await transaction.rollback();
        if (error.errors) {
          return res.status(400).json(response(false, error.errors));
        }
        return res.status(400).json(response(false, error.message));
      }
      await transaction.commit();
      return res.status(200).json(response(true, 'Pengajuan berhasil direspon'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  editBonusSubmission: async (req, res) => {
    const { submissionId } = req.params;
    const host =
      process.env.NODE_ENV !== 'production'
        ? `http://${config.host}:${config.port}/`
        : `https://${config.host}/`;
    try {
      const submission = await SubmissionsModel.findOne({ where: { id: submissionId } });
      // Check Submission Existence
      if (!submission)
        return res.status(400).json(response(false, 'Data pengajuan tidak ditemukan'));
      // Compose Payload
      const payload = {
        date: req.body.date,
        type: req.body.type,
        note: req.body.note,
        amount: req.body.amount,
        status: 1
      };
      // Begin Trasnsaction
      const transaction = await sequelize.transaction();
      try {
        const updateSubmission = await SubmissionsModel.update(payload, {
          where: { id: submissionId },
          returning: true,
          transaction
        });
        if (!updateSubmission) {
          await transaction.rollback();
          return res.status(400).json(response(false, 'Gagal mengedit pengajuan bonus'));
        }
        // Check is user update photo too
        if (req.file) {
          const filepath = req.file.path.split('/')[1];
          const digitalAssetPayload = {
            path: req.file.path,
            filename: req.file.filename,
            url: `${host}${filepath}/${req.file.filename}`
          };
          const updateDigitalAsset = await DigitalAsset.update(digitalAssetPayload, {
            where: { uploadable_id: submissionId, type: 'bonus' },
            returning: true,
            transaction
          });
          if (!updateDigitalAsset) {
            await transaction.rollback();
            return res.status(400).json(response(false, 'Gagal mengedit pengajuan bonus'));
          }
        }
      } catch (error) {
        await transaction.rollback();
        if (error.errors) {
          return res.status(400).json(response(false, error.errors));
        }
        return res.status(400).json(response(false, error.message));
      }
      await transaction.commit();
      return res.status(200).json(response(true, 'Pengajuan bonus berhasil diubah'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  abortBonusSubmission: async (req, res) => {
    const { submissionId } = req.params;
    const { employeeId } = res.local.users;
    try {
      const submission = await SubmissionsModel.findOne({ where: { id: submissionId } });
      if (!submission)
        return res.status(400).json(response(false, 'Data pengajuan bonus tidak ditemukan'));
      const destroySubmission = await SubmissionsModel.destroy({ where: { id: submissionId } });
      if (!destroySubmission)
        return res.status(400).json(response(false, 'Data pengajuan bonus tidak ditemukan'));

      // SEND NOTIFICATION
      const employee = await EmployeesModel.findOne({
        where: { id: employeeId },
        include: { model: UserModel, attributes: ['full_name'] }
      });
      const title = 'Pembatalan Pengajuan Bonus';
      const description = `${
        employee.user.full_name
      } telah membatalkan pengajuan bonus untuk tanggal ${
        submission.date
      } senilai Rp. ${formatCurrency(submission.amount)}`;
      observe.emit(EVENT.SUBMISSION_ABORT, {
        employeeId,
        companyId: employee.company_id,
        title,
        description
      });
      return res.status(200).json(response(true, 'Pengajuan bonus berhasil dibatalkan'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  createThrowSchedule: async (req, res) => {
    const { employeeId, companyParentId, id } = res.local.users;
    const { data } = req.body;
    const transaction = await sequelize.transaction();
    try {
      let scheduleTemplateCollections = [];
      let definedScheduleCollections = [];
      let scheduleTemplateDateGroup = [];
      let scheduleNotePayload = [];
      // Grouping Schedule ID Based on Table Origin
      for (const schedule of data.schedules) {
        if (schedule.schedule_template_id) {
          scheduleTemplateCollections.push(schedule);
        }
        if (schedule.defined_schedule_id) {
          definedScheduleCollections.push(schedule);
        }
      }
      // Gather Schedule Template Dates by Grouping ID
      let scheduleId = '';
      for (const schedule of scheduleTemplateCollections) {
        if (scheduleId !== schedule.schedule_template_id) {
          const compose = {
            scheduleId: schedule.schedule_template_id,
            dates: [schedule.date]
          };
          scheduleTemplateDateGroup.push(compose);
        }
        if (scheduleId === schedule.schedule_template_id) {
          const index = scheduleTemplateDateGroup.findIndex(
            val => val.scheduleId === schedule.schedule_template_id
          );
          scheduleTemplateDateGroup[index].dates.push(schedule.date);
        }
        scheduleId = schedule.schedule_template_id;
      }
      // Handle Data From Schedule Template
      for (const schedule of scheduleTemplateDateGroup) {
        // Delete Schedule Template with Given Dates
        const scheduleTemplate = await ScheduleTemplate.findOne({
          where: { id: schedule.scheduleId },
          include: {
            model: ScheduleShiftDetail,
            where: { schedule_type: 'schedule_templates' },
            as: 'shift',
            required: false
          }
        });
        const existedDeletedDate =
          scheduleTemplate.deleted_date !== null ? scheduleTemplate.deleted_date : '';
        const compose = {
          deleted_date: existedDeletedDate.concat(
            `${scheduleTemplate.deleted_date !== null ? ',' : ''}${schedule.dates.toString()}`
          )
        };
        const updateScheduleTemplate = await ScheduleTemplate.update(
          compose,
          {
            where: { id: schedule.scheduleId }
          },
          { transaction }
        );
        if (!updateScheduleTemplate) {
          await transaction.rollback();
          return res
            .status(400)
            .json(response(false, 'Gagal membuat data beri jadwal untuk diambil'));
        }
        let scheduleShiftDetailPayload = [];
        for (const date of schedule.dates) {
          // Create Defined Schedule Based on Given Dates
          const createDefinedSchedule = await DefinedSchedule.create(
            {
              employee_id: employeeId,
              company_id: scheduleTemplate.company_id,
              presence_date: date,
              status: 1
            },
            { transaction }
          );
          if (!createDefinedSchedule) {
            await transaction.rollback();
            return res
              .status(400)
              .json(response(false, 'Gagal membuat data beri jadwal untuk diambil'));
          }
          // Create Record on Schedule Submission for Logging
          const createScheduleSubmissioin = await ScheduleSubmission.create(
            {
              employee_id: employeeId,
              defined_schedule_id: createDefinedSchedule.id,
              status: 0,
              type: 1
            },
            { transaction }
          );
          if (!createScheduleSubmissioin) {
            await transaction.rollback();
            return res
              .status(400)
              .json(response(false, 'Gagal membuat data beri jadwal untuk diambil'));
          }
          scheduleShiftDetailPayload.push({
            shift_id: scheduleTemplate.shift.shift_id,
            schedule_id: createDefinedSchedule.id,
            schedule_type: 'defined_schedules'
          });
          scheduleNotePayload.push({
            schedule_id: createDefinedSchedule.id,
            schedule_type: 'defined_schedules',
            note: data.note
          });
        }
        // Create Schedule Shift Detail
        const createScheduleShiftDetail = await ScheduleShiftDetail.bulkCreate(
          scheduleShiftDetailPayload,
          { transaction }
        );
        if (!createScheduleShiftDetail) {
          await transaction.rollback();
          return res
            .status(400)
            .json(response(false, 'Gagal membuat data beri jadwal untuk diambil'));
        }
      }

      // Handle Data From Defined Schedule
      for (const schedule of definedScheduleCollections) {
        const updateDefinedSchedule = await DefinedSchedule.update(
          { status: 1 },
          { where: { id: schedule.defined_schedule_id } },
          { transaction }
        );
        // Create Record on Schedule Submission for Logging
        const createScheduleSubmissioin = await ScheduleSubmission.create(
          {
            employee_id: employeeId,
            defined_schedule_id: schedule.defined_schedule_id,
            status: 0,
            type: 1
          },
          { transaction }
        );
        if (!createScheduleSubmissioin) {
          await transaction.rollback();
          return res
            .status(400)
            .json(response(false, 'Gagal membuat data beri jadwal untuk diambil'));
        }
        scheduleNotePayload.push({
          schedule_id: schedule.defined_schedule_id,
          schedule_type: 'defined_schedules',
          note: data.note
        });
        if (!updateDefinedSchedule) {
          await transaction.rollback();
          return res
            .status(400)
            .json(response(false, 'Gagal membuat data beri jadwal untuk diambil'));
        }
      }
      // Create Schedule Note
      const createScheduleNote = await ScheduleNote.bulkCreate(scheduleNotePayload, {
        transaction
      });
      if (!createScheduleNote) {
        await transaction.rollback();
        return res
          .status(400)
          .json(response(false, 'Gagal membuat data beri jadwal untuk diambil'));
      }
      await transaction.commit();
      // send notification
      const user = await UserModel.findOne({ where: { id }, attributes: ['full_name'] });
      observe.emit(EVENT.SUBMISSION_CREATION, {
        parentCompanyId: companyParentId,
        message: {
          title: 'Pengajuan Lempar Jadwal',
          body: `${user.full_name} telah mengajukan lempar jadwal`
        },
        ability: 'SUBMISSION_SCHEDULE'
      });
      return res.status(200).json(response(true, 'Pengajuan lempar jadwal berhasil dilakukan'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  createScheduleSwap: async (req, res) => {
    const { data } = req.body;
    const transaction = await sequelize.transaction();
    const selects = ['self_data', 'away_data'];
    let scheduleSwapDetailPayload = [];
    try {
      // create schedule swap
      const createScheduleSwap = await ScheduleSwap.create(
        {
          company_id: data.company_id,
          description: `${data.self_data.full_name} -> ${data.away_data.full_name}`,
          status: 0,
          self_id: data.self_data.employee_id,
          away_id: data.away_data.employee_id,
          note: data.note
        },
        { transaction }
      );
      if (!createScheduleSwap) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal melakukan tukar jadwal'));
      }

      for (const select of selects) {
        // check is self data / away data from defined or templated schedule
        if (data[select].schedule_template_id) {
          // get schedule template
          const scheduleTemplate = await ScheduleTemplate.findOne({
            where: { id: data[select].schedule_template_id },
            include: {
              model: ScheduleShiftDetail,
              where: { schedule_type: 'schedule_templates' },
              as: 'shift',
              required: false
            }
          });
          // Delete schedule template by given date
          const existedDeletedDate =
            scheduleTemplate.deleted_date !== null ? scheduleTemplate.deleted_date : '';
          const compose = {
            deleted_date: existedDeletedDate.concat(
              `${scheduleTemplate.deleted_date !== null ? ',' : ''}${data[select].date}`
            )
          };
          const updateScheduleTemplate = await ScheduleTemplate.update(
            compose,
            {
              where: { id: data[select].schedule_template_id }
            },
            { transaction }
          );
          if (!updateScheduleTemplate) {
            await transaction.rollback();
            return res.status(400).json(response(false, 'Gagal melakukan tukar jadwal'));
          }
          // create defined schedule
          const createDefinedSchedule = await DefinedSchedule.create(
            {
              employee_id: scheduleTemplate.employee_id,
              company_id: scheduleTemplate.company_id,
              presence_date: data[select].date,
              status: select === 'self_data' ? 3 : 4
            },
            { transaction }
          );
          if (!createDefinedSchedule) {
            await transaction.rollback();
            return res.status(400).json(response(false, 'Gagal melakukan tukar jadwal'));
          }
          // create schedule shift details
          const createScheduleShiftDetail = await ScheduleShiftDetail.create(
            {
              shift_id: scheduleTemplate.shift.shift_id,
              schedule_id: createDefinedSchedule.id,
              schedule_type: 'defined_schedules'
            },
            { transaction }
          );
          if (!createScheduleShiftDetail) {
            await transaction.rollback();
            return res.status(400).json(response(false, 'Gagal melakukan tukar jadwal'));
          }
          scheduleSwapDetailPayload.push({
            schedule_swap_id: createScheduleSwap.id,
            schedule_id: createDefinedSchedule.id
          });
        } else {
          // check is self data / away data from defined or defined schedule
          const updateDefinedSchedule = await DefinedSchedule.update(
            { status: select === 'self_data' ? 3 : 4 },
            { where: { id: data[select].defined_schedule_id } },
            { transaction }
          );
          if (!updateDefinedSchedule) {
            await transaction.rollback();
            return res.status(400).json(response(false, 'Gagal melakukan tukar jadwal'));
          }
          scheduleSwapDetailPayload.push({
            schedule_swap_id: createScheduleSwap.id,
            schedule_id: data[select].defined_schedule_id
          });
        }
      }
      // create schedule swap detail
      const createScheduleSwapDetail = await ScheduleSwapDetail.bulkCreate(
        scheduleSwapDetailPayload,
        { transaction }
      );
      if (!createScheduleSwapDetail) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal melakukan tukar jadwal'));
      }
      // send notification
      observe.emit(EVENT.ASK_SCHEDULE_SWAP, {
        employeeIds: [data.self_data.employee_id, data.away_data.employee_id],
        targetDate: data.away_data.date
      });

      await transaction.commit();
      return res.status(201).json(response(true, 'Pengajuan tukar jadwal berhasil dilakukan'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getHistory: async (req, res) => {
    const { employeeId, employeeRole, companyParentId } = res.local.users;
    try {
      const submissions = await SubmissionsModel.findAll({
        order: [['created_at', 'desc']],
        where: [
          {},
          employeeRole !== 1 && { employee_id: employeeId },
          { [Op.or]: [{ type: 2 }, { type: 6 }] },
          { [Op.or]: [{ status: 1 }, { status: -1 }] }
        ],
        include: [
          {
            model: EmployeesModel,
            attributes: ['id'],
            required: true,
            include: [
              { model: UserModel, attributes: ['full_name'] },
              {
                model: DigitalAsset,
                attributes: ['url'],
                required: false,
                where: {
                  type: 'avatar'
                },
                as: 'assets'
              },
              {
                model: Company,
                attributes: ['company_name', 'name'],
                required: true,
                where: { parent_company_id: companyParentId }
              }
            ]
          }
        ]
      });

      const presences = await PresenceModel.findAll({
        where: [
          { [Op.or]: [{ custom_presence: 0 }, { custom_presence: -1 }], is_custom_presence: 1 },
          employeeRole !== 1 && { employee_id: employeeId }
        ],
        include: [
          {
            model: EmployeesModel,
            attributes: ['id'],
            required: true,
            include: [
              { model: UserModel, attributes: ['full_name'] },
              {
                model: DigitalAsset,
                attributes: ['url'],
                required: false,
                where: {
                  type: 'avatar'
                },
                as: 'assets'
              },
              {
                model: Company,
                attributes: ['company_name', 'name'],
                required: true,
                where: { parent_company_id: companyParentId }
              }
            ]
          }
        ]
      });

      const responses = [];
      for (const data of submissions) {
        let submissionName = 'Tambah Jatah Cuti';
        if (data.presence_type === 1) submissionName = 'Cuti';
        if (data.presence_type === 2) submissionName = 'Izin';
        responses.push({
          submission_id: data.id,
          employee_id: data.employee_id,
          full_name: data.employee.user.full_name,
          avatar: data.employee.assets.length ? data.employee.assets[0].url : null,
          presence_type_name: submissionName,
          branch: data.employee.company.company_name || data.employee.company.company_name,
          status: data.status,
          created_at: data.created_at
        });
      }
      for (const data of presences) {
        responses.push({
          submission_id: data.id,
          employee_id: data.employee_id,
          full_name: data.employee.user.full_name,
          avatar: data.employee.assets.length ? data.employee.assets[0].url : null,
          presence_type_name: 'Ceklok Lokasi Lain',
          branch: data.employee.company.company_name || data.employee.company.company_name,
          status: data.custom_presence === 0 ? 1 : 0,
          created_at: data.created_at
        });
      }
      return res
        .status(200)
        .json(response(true, 'Data riwayat kehadiran berhasil didapatkan', responses));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = companiesService;

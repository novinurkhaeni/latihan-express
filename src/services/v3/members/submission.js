require('module-alias/register');
const { response } = require('@helpers');
const {
  sequelize,
  digital_assets: DigitalAsset,
  submissions: SubmissionsModel,
  employees: EmployeeModel
} = require('@models');
const config = require('config');

const submission = {
  createPresenceSubmission: async (req, res) => {
    const { employeeId } = req.params;
    const transaction = await sequelize.transaction();
    try {
      const employee = await EmployeeModel.findOne({ where: { id: employeeId } });
      if (!employee) {
        return res.status(400).json(response(false, 'Anggota tidak ditemukan'));
      }

      const host =
        process.env.NODE_ENV !== 'production'
          ? `http://${config.host}:${config.port}/`
          : `https://${config.host}/`;

      const submissionPayload = {
        employee_id: employeeId,
        start_date: req.body.start_date,
        end_date: req.body.end_date,
        presence_type: req.body.presence_type,
        note: req.body.note,
        type: 7,
        status: 1
      };
      // Create Submission
      const createSubmission = await SubmissionsModel.create(submissionPayload, { transaction });
      if (!createSubmission) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal membuat pengajuan absensi'));
      }
      // Create Asset
      const filepath = req.file.path.split('/')[1];
      let digitalAssetPayload = {
        type: 'presenceSubmission',
        uploadable_type: 'submissions',
        uploadable_id: createSubmission.id,
        path: req.file.path,
        filename: req.file.filename,
        mime_type: req.file.mimetype,
        url: `${host}${filepath}/${req.file.filename}`
      };
      const createAsset = await DigitalAsset.create(digitalAssetPayload, { transaction });
      if (!createAsset) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal membuat pengajuan absensi'));
      }
      await transaction.commit();
      return res.status(201).json(response(true, 'Berhasil membuat pengajuan absensi'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  getBonusSubmissionHistory: async (req, res) => {
    const { employee_id } = req.params;
    try {
      const getHistory = await SubmissionsModel.findAll({ where: { employee_id, type: 5 } });
      return res
        .status(201)
        .json(response(true, 'Riwayat pengajuan bonus berhasil didapatkan', getHistory));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = submission;

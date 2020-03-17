require('module-alias/register');
const { response } = require('@helpers');
const {
  sequelize,
  employee_verifs: EmployeeVerif,
  employees: Employee,
  users: User,
  bank_data: BankData,
  digital_assets: DigitalAsset
} = require('@models');
const config = require('config');

const verificationService = {
  getVerification: async (req, res) => {
    const { employee_id } = req.params;
    try {
      const verifData = await getVerifData(employee_id);
      if (!verifData) return res.status(400).json(response(false, 'employee tidak di temukan'));
      let assets, verifStatus, bankData, verifPayload;

      if (verifData.employee_verif) {
        assets = verifData.employee_verif.assets.reduce((acc, item) => {
          const payload = {
            id: item.id,
            type: item.type,
            url: item.url
          };
          acc.push(payload);

          return acc;
        }, []);

        verifStatus = {
          id: verifData.employee_verif.id,
          employee_id: verifData.employee_verif.employee_id,
          status: verifData.employee_verif.status
        };
        bankData = verifData.user.bank_data[0];
        verifPayload = {
          assets,
          verif_status: verifStatus,
          bank_data: bankData
        };
      } else {
        verifPayload = null;
      }
      return res
        .status(200)
        .json(response(true, 'berhasil mendapatkan verifikasi data', verifPayload));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  editVerification: async (req, res) => {
    const { employee_id } = req.params;
    const { files, body } = req;
    const host =
      process.env.NODE_ENV !== 'production'
        ? `http://${config.host}:${config.port}/`
        : `https://${config.host}/`;
    const transaction = await sequelize.transaction();
    try {
      const employeeVerif = await EmployeeVerif.findOne({ where: { employee_id } });
      if (!employeeVerif)
        return res.status(400).json(response(false, 'Anda belum mengajukan verifikasi'));

      const updateEmployeVerif = await EmployeeVerif.update(
        { status: 0 },
        { where: { employee_id } },
        { transaction }
      );
      if (!updateEmployeVerif) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Verifikasi gagal diubah'));
      }
      for (let i = 0; i < files.length; i++) {
        //if frontend customize file type use the file type from front end,
        //else first file will have type ktp and the second will have type selfie
        let type;
        if (files[i].type) {
          type = files[i].type;
        } else {
          if (i === 0) {
            type = 'ktp';
          } else if (i === 1) {
            type = 'selfie';
          }
        }
        const filepath = files[i].destination.split('/')[1];
        const digitalAssetPayload = {
          uploadable_id: employeeVerif.id,
          uploadable_type: 'employee_verifs',
          type,
          path: files[i].path,
          filename: files[i].filename,
          mime_type: files[i].mimetype,
          url: `${host}${filepath}/${files[i].filename}`
        };

        let digitalAsset;

        if (type === 'ktp') {
          digitalAsset = await DigitalAsset.update(digitalAssetPayload, {
            where: { id: body.ktp_id },
            returning: true,
            transaction
          });
        } else if (type === 'selfie') {
          digitalAsset = await DigitalAsset.update(digitalAssetPayload, {
            where: { id: body.selfie_id },
            returning: true,
            transaction
          });
        }

        if (!digitalAsset) {
          await transaction.rollback();
          return res.status(400).json(response(false, 'Verifikasi gagal diubah'));
        }
      }

      const bankDataPayload = {
        full_name: body.full_name,
        bank_name: body.bank_name,
        account_number: body.account_number
      };

      const bankData = await BankData.update(bankDataPayload, {
        where: { id: body.bank_id },
        returning: true,
        transaction
      });

      if (!bankData) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Verifikasi gagal diubah'));
      }

      await transaction.commit();
      return res.status(200).json(response(true, 'Data verifikasi berhasil diubah'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  upload: async (req, res) => {
    const { employee_id } = req.params;
    const { files, body } = req;
    const host =
      process.env.NODE_ENV !== 'production'
        ? `http://${config.host}:${config.port}/`
        : `https://${config.host}/`;
    const transaction = await sequelize.transaction();
    try {
      const employee = await getEmployee(employee_id);
      if (!employee) return res.status(400).json(response(false, 'employee tidak di temukan'));
      if (employee.employee_verif)
        return res.status(400).json(response(false, 'employee sudah mengajukan verifikasi'));
      const employeeVerif = await EmployeeVerif.create(
        {
          employee_id,
          status: 0
        },
        { transaction }
      );

      if (!employeeVerif)
        return res.status(400).json(response(false, 'file dan data gagal di kirim'));
      const digitalAssetBulk = [];

      for (let i = 0; i < files.length; i++) {
        //if frontend customize file type use the file type from front end,
        //else first file will have type ktp and the second will have type selfie
        let type;
        if (files[i].type) {
          type = files[i].type;
        } else {
          if (i === 0) {
            type = 'ktp';
          } else if (i === 1) {
            type = 'selfie';
          }
        }
        const filepath = files[i].destination.split('/')[1];
        const digitalAssetPayload = {
          uploadable_id: employeeVerif.id,
          uploadable_type: 'employee_verifs',
          type,
          path: files[i].path,
          filename: files[i].filename,
          mime_type: files[i].mimetype,
          url: `${host}${filepath}/${files[i].filename}`
        };

        digitalAssetBulk.push(digitalAssetPayload);
      }

      const digitalAsset = await DigitalAsset.bulkCreate(digitalAssetBulk, { transaction });
      if (!digitalAsset) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'file dan data gagal di kirim'));
      }

      const bankDataPayload = {
        full_name: body.full_name,
        bank_name: body.bank_name,
        account_number: body.account_number,
        active: 1,
        user_id: employee.user.id
      };

      const bankData = await BankData.create(bankDataPayload, { transaction });

      if (!bankData) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'file dan data gagal di kirim'));
      }

      await transaction.commit();
      return res.status(201).json(response(true, 'file dan data berhasil di kirim'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = verificationService;

const getEmployee = async idEmployee => {
  const employee = await Employee.findOne({
    where: { id: idEmployee },
    include: [
      {
        model: User,
        attributes: ['id', 'full_name', 'email', 'phone']
      },
      {
        model: EmployeeVerif
      }
    ]
  });
  return employee;
};

const getVerifData = async idEmployee => {
  const verifData = await Employee.findOne({
    where: { id: idEmployee },
    include: [
      {
        model: User,
        attributes: ['id', 'full_name', 'email', 'phone'],
        include: [
          {
            model: BankData
          }
        ]
      },
      {
        model: EmployeeVerif,
        include: [
          {
            model: DigitalAsset,
            as: 'assets'
          }
        ]
      }
    ]
  });
  return verifData;
};

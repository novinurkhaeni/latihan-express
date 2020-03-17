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

const bankData = {
  delete: async (req, res) => {
    const { employee_id } = req.params;
    const transaction = await sequelize.transaction();
    try {
      const employee = await Employee.findOne({
        where: { id: employee_id },
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
      if (!employee) {
        return res.status(400).json(response(false, 'employee tidak di temukan'));
      }

      if (employee.user.bank_data.length < 1 || !employee.user.bank_data) {
        return res.status(400).json(response(false, 'employee tidak memiliki bank data'));
      }

      if (employee.employee_verif) {
        const employeeVerifDestroy = await EmployeeVerif.destroy({
          where: {
            employee_id
          },
          transaction
        });

        if (!employeeVerifDestroy) {
          await transaction.rollback();
          return res.status(400).json(response(false, 'bank data gagal di hapus'));
        }

        const digitalAssetDestroy = await DigitalAsset.destroy({
          where: {
            uploadable_type: 'employee_verifs',
            uploadable_id: employee.employee_verif.id
          },
          transaction
        });

        if (!digitalAssetDestroy) {
          await transaction.rollback();
          return res.status(400).json(response(false, 'bank data gagal di hapus'));
        }
      }

      const bankDataDestroy = await BankData.destroy({
        where: {
          user_id: employee.user.id
        },
        transaction
      });

      if (!bankDataDestroy) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'bank data gagal di hapus'));
      }

      await transaction.commit();
      return res.status(200).json(response(true, 'bank data berhasil di hapus'));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = bankData;

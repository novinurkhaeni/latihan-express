require('module-alias/register');
const {
  response,
  dateProcessor: { getRangedDate }
} = require('@helpers');
const {
  sequelize,
  employees: Employee,
  salary_details: SalaryDetail,
  cron_members_salary_groups: CronMemberSalaryGroup,
  journals: Journal,
  companies: Company,
  company_settings: CompanySetting
} = require('@models');

const salaryGroup = {
  update: async (req, res) => {
    const { employee_id } = req.params;
    const { data } = req.body;
    try {
      const checkPayrollDate = await Employee.findOne({
        where: { id: employee_id },
        include: {
          model: Company,
          attributes: ['id'],
          include: { model: CompanySetting, attributes: ['payroll_date'], as: 'setting' }
        }
      });
      const payrollDate = getRangedDate(checkPayrollDate.company.setting.payroll_date);
      // Check is member has running salary
      const journals = await Journal.findOne({
        where: [
          {
            employee_id,
            type: 'salary'
          },
          sequelize.where(
            sequelize.fn('DATE_FORMAT', sequelize.col('journals.created_at'), '%Y-%m-%d'),
            '>=',
            payrollDate.dateStart
          ),
          sequelize.where(
            sequelize.fn('DATE_FORMAT', sequelize.col('journals.created_at'), '%Y-%m-%d'),
            '<=',
            payrollDate.dateEnd
          )
        ]
      });

      if (journals && !data.is_confirm) {
        return res
          .status(400)
          .json(
            response(
              true,
              `Apakah Anda yakin akan mengganti Golongan Gaji Karyawan menjadi ${
                data.salary_group_id ? 'Gaji Per Bulan' : 'Gaji Per Shift'
              } ?\n\nJenis Golongan Gaji Karyawan akan otomatis berubah pada bulan berikutnya`,
              false,
              { showAlert: true }
            )
          );
      }

      // If member doesnt have journal in current payroll date, directly change the salary group
      if (!journals) {
        const checkSalaryDetail = await SalaryDetail.findOne({ where: { employee_id } });
        if (checkSalaryDetail) {
          if (data.salary_group_id) {
            const updateSalaryDetail = await SalaryDetail.update(
              { salary_id: data.salary_group_id },
              { where: { id: checkSalaryDetail.id } }
            );
            if (!updateSalaryDetail) {
              return res
                .status(400)
                .json(response(false, 'Gagal mengubah golongan gaji', '', { showAlert: false }));
            }
          } else {
            const deleteSalaryDetail = await SalaryDetail.destroy({
              where: { id: checkSalaryDetail.id }
            });
            if (!deleteSalaryDetail) {
              return res
                .status(400)
                .json(response(false, 'Gagal mengubah golongan gaji', '', { showAlert: false }));
            }
          }
        } else {
          if (data.salary_group_id) {
            const createSalaryDetail = await SalaryDetail.create({
              employee_id,
              salary_id: data.salary_group_id
            });
            if (!createSalaryDetail) {
              return res
                .status(400)
                .json(response(false, 'Gagal mengubah golongan gaji', '', { showAlert: false }));
            }
          }
        }
        return res
          .status(200)
          .json(response(true, 'Golongan gaji berhasil diubah', '', { showAlert: false }));
      } else {
        const checkCron = await CronMemberSalaryGroup.findOne({ where: { employee_id } });
        if (checkCron) {
          const updateCron = await CronMemberSalaryGroup.update(
            { salary_id: data.salary_group_id },
            { where: { id: checkCron.id } }
          );
          if (!updateCron) {
            return res
              .status(400)
              .json(response(false, 'Gagal mengubah golongan gaji', '', { showAlert: false }));
          }
        } else {
          const createCron = await CronMemberSalaryGroup.create({
            employee_id,
            salary_id: data.salary_group_id
          });
          if (!createCron) {
            return res
              .status(400)
              .json(response(false, 'Gagal mengubah golongan gaji', '', { showAlert: false }));
          }
        }
        return res.status(200).json(
          response(true, 'Golongan gaji akan berubah setelah tanggal buka buku', '', {
            showAlert: false
          })
        );
      }
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  abortSalaryChange: async (req, res) => {
    const { employee_id } = req.params;
    try {
      const deleteSalaryChange = await CronMemberSalaryGroup.destroy({ where: { employee_id } });
      if (!deleteSalaryChange) {
        return res.status(400).json(response(false, 'Gagal membatalkan perubahan gaji'));
      }
      return res.status(200).json(response(true, 'Gaji berhasil dibatalkan'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = salaryGroup;

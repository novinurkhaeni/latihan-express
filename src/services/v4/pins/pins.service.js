require('module-alias/register');
const { Sequelize } = require('sequelize');

const { response, nodemailerMail, mailTemplates } = require('@helpers');
const { users: UserModel, employees: EmployeeModel, pins: PinModel } = require('@models');

const pinService = {
  forgot: async (req, res) => {
    const { phone } = req.query;
    try {
      const phoneNumber = phone.replace(/^0+/, '');
      // Get Employee ID
      const userData = await UserModel.findOne({
        attributes: ['id', 'full_name', 'email', 'phone'],
        where: [
          {},
          Sequelize.literal(
            `case when (substring(phone, 1, 1)) = "0" then (substring(phone, 2, 50)) = "${phoneNumber}" when (substring(phone, 1, 1)) != "0" then(phone = "${phoneNumber}") end`
          )
        ],
        include: [{ model: EmployeeModel, attributes: ['id', 'user_id', 'company_id'] }]
      });
      if (!userData) throw new Error('phone user does not exists');

      // Retrieve pemilik usaha
      const ownerData = await UserModel.findOne({
        attributes: ['id', 'email', 'full_name'],
        include: [
          {
            model: EmployeeModel,
            where: { company_id: userData.employees[0].company_id, role: 1 },
            attributes: ['id', 'user_id', 'company_id', 'role', 'active']
          }
        ]
      });
      if (!ownerData) throw new Error('Error! company id related to this employee does not exist');

      const checkPin = await PinModel.findOne({ where: { user_id: userData.id } });
      if (!checkPin) throw new Error('Error. could NOT find PIN record');

      //send mailer
      /* new wireframe 3.1, Create notification push email to pemilik usaha */
      await nodemailerMail.sendMail({
        from: 'cs@atenda.id',
        to: ownerData.email,
        subject: `Atenda: Notifikasi Lupa pin - ${userData.full_name}`,
        html: mailTemplates.forgotPinTemplate({
          employee: userData,
          owner: ownerData,
          newPin: checkPin.pin
        })
      });

      return res
        .status(200)
        .json(
          response(
            true,
            `PIN baru telah dikirim ke email Pemilik Usaha. \n\nUntuk mengubah PIN dapat ke menu Pengaturan > Akun > Ganti PIN`
          )
        );
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      } else {
        return res.status(400).json(response(false, error.message));
      }
    }
  }
};

module.exports = pinService;

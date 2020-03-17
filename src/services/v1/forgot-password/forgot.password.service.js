require('module-alias/register');
const { response, nodemailerMail, mailTemplates } = require('@helpers');
const { users: User } = require('@models');
const crypt = require('bcrypt');
const randomstring = require('randomstring');

const forgotPasswordService = {
  create: async (req, res) => {
    const { emailphone } = req.body.data;
    try {
      const user = await User.findOne({
        where: {
          $or: [{ email: emailphone }, { phone: emailphone }]
        }
      });

      if (!user) {
        return res.status(400).json(response(false, 'Email/nomor tidak terdaftar!'));
      }

      if (user.registration_complete.toString() !== '1') {
        return res
          .status(200)
          .json(response(false, 'Email/nomor tercatat belum menyelesaikan registrasi'));
      }

      const passgen = randomstring.generate(8);
      const hashPassword = crypt.hashSync(passgen, 15);

      nodemailerMail.sendMail(
        {
          from: 'cs@atenda.id',
          to: user.email, // An array if you have multiple recipients.
          subject: 'Reset Password - Atenda',
          //You can use "html:" to send HTML email content. It's magic!
          html: mailTemplates.forgotPasswordTemplate({ passgen })
        },
        async function(err, info) {
          if (err) {
            let errorLog = new Date().toISOString() + ' : ' + err + '\n';
            global.emailErrorLog.write(errorLog);
            return res
              .status(400)
              .json(response(false, 'Gagal mengirim email, lakukan reset password lagi', err));
          } else {
            const results = await User.update(
              {
                password: hashPassword
              },
              { where: { email: user.email } }
            );
            if (results) {
              return res
                .status(200)
                .json(response(true, 'Password berhasil direset, silakan cek email anda'));
            } else {
              return res
                .status(400)
                .json(response(false, 'Gagal mereset password, namun email terkirim'));
            }
          }
        }
      );
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = forgotPasswordService;

require('module-alias/register');
const {
  Sequelize: { Op }
} = require('sequelize');
const {
  response,
  jwtHelpers,
  abilityFinder,
  nodemailerMail,
  mailTemplates,
  encrypt
} = require('@helpers');
const {
  sequelize,
  users: User,
  employees: Employee,
  companies: Company,
  company_settings: CompanySetting,
  parent_companies: ParentCompany,
  pins: Pin,
  access_tokens: AccessToken
} = require('@models');
const config = require('config');

const registerService = {
  owner: async (req, res) => {
    const { data } = req.body;
    const transaction = await sequelize.transaction();
    try {
      // Create Data User
      const userPayload = {
        full_name: data.user.full_name,
        email: data.user.email,
        phone: data.user.phone,
        demo_mode: 0,
        demo_step: -1,
        registration_complete: 1,
        is_active_notif: 1,
        is_phone_confirmed: 1,
        is_has_dummy: 0,
        is_email_confirmed: data.register_by === 'google' ? 1 : 0
      };
      const createUser = await User.create(userPayload, { transaction });
      if (!createUser) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal menyimpan user'));
      }
      // Create Company Data
      const createCompany = await checkCompany(data, transaction);
      if (createCompany.errorMessage) {
        return res.status(422).json(response(false, createCompany.errorMessage));
      }
      // Create Employee Data
      const employeePayload = {
        company_id: createCompany.company.id,
        user_id: createUser.id,
        role: 1,
        flag: 3,
        active: 1
      };
      const createEmployee = await Employee.create(employeePayload, { transaction });
      if (!createEmployee) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal menyimpan data employee'));
      }
      // Create Company Settings
      const companySettingPayload = {
        company_id: createCompany.company.id,
        presence_overdue_limit: 0,
        rest_limit: 60
      };
      const createCompanySetting = await CompanySetting.create(companySettingPayload, {
        transaction
      });
      if (!createCompanySetting) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal menyimpan data seting perusahaan'));
      }
      // Create PIN
      const pinPayload = {
        employee_id: createEmployee.id,
        user_id: createUser.id,
        pin: data.user.pin,
        use_fingerprint: 0,
        apple_biometric: 0
      };
      const createPin = await Pin.create(pinPayload, { transaction });
      if (!createPin) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal menyimpan data pin'));
      }

      // Commit
      await transaction.commit();

      // Create Token
      const cToken = await checkToken(data, createUser, createEmployee, createCompany);
      if (cToken.errorMessage) {
        return res.status(422).json(response(false, cToken.errorMessage));
      }
      let token = cToken.data;

      // Send Response
      const responses = {
        user: {
          id: createUser.id,
          employee_id: createEmployee.id,
          registration_complete: createUser.registration_complete,
          full_name: createUser.full_name,
          email: createUser.email,
          birthday: createUser.birthday,
          phone: createUser.phone,
          pin: createPin.pin,
          pin_id: createPin.id,
          abilities: await abilityFinder({ role: 1 })
        },
        company: {
          id: createCompany.company.id,
          parent_company_id: createCompany.company.parent_company_id,
          company_name: createCompany.company.company_name,
          name: createCompany.company.name,
          unique_id: createCompany.company.unique_id,
          address: createCompany.company.address,
          phone: createCompany.company.phone,
          location: createCompany.company.location,
          codename: createCompany.company.codename
        },
        token: {
          access_token: token.dataValues.access_token,
          refresh_token: token.dataValues.refresh_token,
          expiry_in: token.dataValues.expiry_in
        }
      };

      if (data.register_by === 'manual') {
        const encryptedUserId = encrypt(createUser.id.toString());
        await nodemailerMail.sendMail({
          from: 'cs@atenda.id',
          to: createUser.email,
          subject: `Atenda: Verifikasi Email`,
          html: mailTemplates.emailVerification({
            fullName: createUser.full_name,
            url: `https://${config.host}/api/v4/verify?code=${encryptedUserId}`
          })
        });
      }

      return res.status(201).json(response(true, 'Registrasi Berhasil', responses));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  employee: async (req, res) => {
    const { data } = req.body;
    const transaction = await sequelize.transaction();
    try {
      // Create User
      const userPayload = {
        full_name: data.user.full_name,
        phone: data.user.phone,
        birthday: data.user.birthday,
        email: data.user.email,
        registration_complete: 1,
        is_has_dummy: 1,
        demo_mode: 0,
        demo_step: -1
      };
      const createUser = await User.create(userPayload, { transaction });
      if (!createUser) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal membuat data user'));
      }
      // Create Employee
      const employeePayload = {
        company_id: data.company_id,
        user_id: createUser.id,
        role: 2,
        flag: 2,
        active: 1,
        salary_type: 0,
        gajiandulu_status: 1,
        leave: 15
      };
      const createEmployee = await Employee.create(employeePayload, { transaction });
      if (!createEmployee) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal membuat data employee'));
      }
      // Create PIN
      const pinPayload = {
        employee_id: createEmployee.id,
        user_id: createUser.id,
        pin: data.pin,
        use_fingerprint: 0,
        apple_biometric: 0
      };
      const createPin = await Pin.create(pinPayload, { transaction });
      if (!createPin) {
        await transaction.rollback();
        return res.status(400).json(response(false, 'Gagal membuat pin'));
      }

      await transaction.commit();

      // Get Parent Company ID
      const company = await Company.findOne({
        where: { id: data.company_id }
      });
      // Create Token
      const cToken = await checkToken(data, createUser, createEmployee, { company });
      if (cToken.errorMessage) {
        return res.status(422).json(response(false, cToken.errorMessage));
      }
      let token = cToken.data;

      const responses = {
        user: {
          id: createUser.id,
          employee_id: createEmployee.id,
          registration_complete: createUser.registration_complete,
          full_name: createUser.full_name,
          email: createUser.email,
          birthday: createUser.birthday,
          phone: createUser.phone,
          pin: createPin.pin,
          pin_id: createPin.id,
          abilities: await abilityFinder({ role: 2 })
        },
        company: {
          id: company.id,
          name: company.company_name,
          address: company.address,
          phone: company.phone,
          timezone: company.timezone
        },
        token: {
          access_token: token.dataValues.access_token,
          refresh_token: token.dataValues.refresh_token,
          expiry_in: token.dataValues.expiry_in
        }
      };
      return res.status(201).json(response(true, 'Registrasi Berhasil', responses));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  checkCodename: async (req, res) => {
    try {
      if (req.query.codename) {
        const checkCompany = await Company.findOne({
          attributes: ['id', 'codename', 'company_name'],
          where: { codename: req.query.codename, active: 1, registration_complete: 1 }
        });
        if (!checkCompany) {
          return res.status(400).json(response(false, 'Perusahaan tidak ditemukan'));
        }
        return res.status(200).json(response(true, 'Perusahaan ditemukan', checkCompany));
      }
      if (req.query.email) {
        const checkEmail = await User.findOne({ where: { email: req.query.email } });
        if (checkEmail) {
          return res.status(400).json(response(false, 'Email sudah digunakan'));
        }
        return res.status(200).json(response(true, 'Email belum digunakan'));
      }
      if (req.query.phone) {
        const checkPhone = await User.findOne({ where: { phone: req.query.phone } });
        if (checkPhone) {
          return res.status(400).json(response(false, 'Telepon sudah digunakan'));
        }
        return res.status(200).json(response(true, 'Telepon belum digunakan'));
      }
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

const checkCompany = async (data, transaction) => {
  let response = {
    errorMessage: '',
    company: ''
  };

  let finalCode;
  let company;

  let codeName = data.company.name
    .match(/(?![EIOU])[B-Z]/gi)
    .toString()
    .replace(/,/g, '')
    .substring(0, 3)
    .toUpperCase();
  if (codeName.length < 3) {
    const long = 3 - codeName.length;
    codeName = codeName + 'X'.repeat(long);
  }

  const companyExist = await Company.findOne({
    order: [['codename', 'DESC']],
    where: { codename: { [Op.regexp]: `${codeName}[0-9]` }, registration_complete: 0 }
  });

  if (companyExist) {
    const payload = Object.assign({}, data, {
      company_name: data.company.name,
      name: data.company.name,
      active: 1,
      registration_complete: 1
    });
    company = await Company.update(payload, {
      where: { id: companyExist.id },
      transaction
    });
    if (!company) {
      await transaction.rollback();
      response.errorMessage = 'Gagal membuat perusahaan baru';
      return response;
    }
    company = companyExist;
  } else {
    const isCodenameUsed = await Company.findOne({
      order: [['codename', 'DESC']],
      where: { codename: { [Op.regexp]: `${codeName}[0-9]` } }
    });

    if (isCodenameUsed) {
      let lastNums = isCodenameUsed.codename.substr(-3);
      lastNums = parseInt(lastNums);
      lastNums++;
      lastNums = ('0000' + lastNums).substr(-3);
      finalCode = codeName + lastNums;
    } else {
      const lastNum = '001';
      finalCode = codeName + lastNum;
    }

    const parentCompany = await ParentCompany.create(
      {
        active: 1,
        company_name: data.company.name
      },
      { transaction }
    );
    if (!parentCompany) {
      await transaction.rollback();
      response.errorMessage = 'Gagal membuat induk perusahaan';
      return response;
    }
    const payload = Object.assign({}, data, {
      company_name: data.company.name,
      name: data.company.name,
      unique_id: data.company.unique_id,
      address: data.company.address,
      location: data.company.location,
      codename: finalCode,
      parent_company_id: parentCompany.dataValues.id,
      registration_complete: 1,
      active: 1
    });
    company = await Company.create(payload, { transaction });
    if (!company) {
      await transaction.rollback();
      response.errorMessage = 'Gagal membuat perusahaan baru';
      return response;
    }
  }
  response.company = company;
  return response;
};

const checkToken = async (data, user, employee, company) => {
  let response = {
    errorMessage: '',
    data: ''
  };
  const expires = 365 * 24 * 60 * 60;
  let createAccessToken;
  const token = jwtHelpers.createJWT(
    Object.assign({
      email: data.user.email,
      phone: data.user.phone,
      id: user.id,
      employeeId: employee.id,
      employeeRole: employee.role,
      companyParentId: company.company.parent_company_id
    }),
    config.authentication.secret,
    expires
  );

  const payload = {
    access_token: token,
    refresh_token: jwtHelpers.refreshToken(),
    provider: 'account-kit',
    user_id: user.id,
    expiry_in: expires
  };

  let accessToken = await AccessToken.findOne({
    where: { user_id: user.id }
  });

  if (!accessToken) {
    createAccessToken = await AccessToken.create(payload);
  } else {
    createAccessToken = await AccessToken.update(payload, {
      where: { user_id: user.id }
    });
  }

  if (!createAccessToken) {
    response.errorMessage = 'Gagal membuat token';
    return response;
  }
  response.data = createAccessToken;
  return response;
};

module.exports = registerService;

require('module-alias/register');
const { response, jwtHelpers } = require('@helpers');
const {
  sequelize,
  companies: Company,
  users: User,
  access_tokens: AccessToken,
  parent_companies: ParentCompany,
  digital_assets: DigitalAsset
} = require('@models');
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const config = require('config');
const crypt = require('bcrypt');

const companyService = {
  /*
   * this method bellow used to register user and create a company by owner
   * before user can create company, user must register and verify the otp from account kit
   * backend process : verify authorization code -> save user data -> save companies data -> save digital_assetss data -> finish
   * authorization code was come from facebook account kit after user verify otp (front_end)
   */

  createOwner: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const { data } = req.body;
      // set null if email payload empty string
      if (data.user.email) {
        if (data.user.email.trim() == '') {
          data.user.email = null;
        }
      }

      // 1. Check user data
      const cUser = await checkUser(data, transaction);
      if (cUser.errorMessage) {
        return res.status(422).json(response(false, cUser.errorMessage));
      }
      let user = cUser.user;

      // 2 check companies
      const cCompany = await checkCompany(data, transaction);
      if (cCompany.errorMessage) {
        return res.status(422).json(response(false, cCompany.errorMessage));
      }
      let company = cCompany.company;

      // 3 check digital_assets
      // Only create digital assets for company if payload is provided
      if (data.company.url) {
        const cDigitalAssets = await checkDigitalAsset(data, company, transaction);
        if (cDigitalAssets.errorMessage) {
          return res.status(422).json(response(false, cDigitalAssets.errorMessage));
        }
      }
      // 4 create token
      const cToken = await checkToken(data, user, transaction);
      if (cToken.errorMessage) {
        return res.status(422).json(response(false, cToken.errorMessage));
      }
      let token = cToken.data;

      // 5 commit transaction
      await transaction.commit();

      // 6 get latest data
      // Get Latest User Data
      if (!user.dataValues) {
        user = await User.findOne({ where: { phone: data.user.phone } });
      }
      // Get Latest Company Data
      if (!company.dataValues) {
        company = await Company.findOne({ where: { id: company } });
      }
      // Get Latest Token Data
      if (!token.dataValues) {
        token = await AccessToken.findOne({
          where: { user_id: user.dataValues.id }
        });
      }

      // 7 create response
      const responses = {
        user: {
          id: user.dataValues.id,
          registration_complete: user.dataValues.registration_complete,
          full_name: user.dataValues.full_name,
          email: user.dataValues.email,
          birthday: user.dataValues.birthday,
          phone: user.dataValues.phone
        },
        company: {
          id: company.dataValues.id,
          parent_company_id: company.dataValues.parent_company_id,
          company_name: company.dataValues.company_name,
          name: company.dataValues.name,
          unique_id: company.dataValues.unique_id,
          address: company.dataValues.address,
          phone: company.dataValues.phone,
          location: company.dataValues.location,
          codename: company.dataValues.codename
        },
        token: {
          access_token: token.dataValues.access_token,
          refresh_token: token.dataValues.refresh_token,
          expiry_in: token.dataValues.expiry_in
        }
      };

      return res
        .status(200)
        .json(response(true, 'Data diri dan informasi perusahaan berhasil didaftarkan', responses));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  /**
   * this method bellow user to register user as employee
   * the flow almost similar with createOwner  method but not same
   */
  createEmployee: async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
      const { data } = req.body;
      // set null if email payload empty string
      if (data.user.email) {
        if (data.user.email.trim() == '') {
          data.user.email = null;
        }
      }

      // 1. Check user data
      const cUser = await checkUser(data, transaction);
      if (cUser.errorMessage) {
        return res.status(422).json(response(false, cUser.errorMessage));
      }
      let user = cUser.user;

      // 2 create token
      const cToken = await checkToken(data, user, transaction);
      if (cToken.errorMessage) {
        return res.status(422).json(response(false, cToken.errorMessage));
      }
      let token = cToken.data;

      // 3 commit transaction
      await transaction.commit();

      // 4 get latest data
      // Get Latest User Data
      if (!user.dataValues) {
        user = await User.findOne({ where: { phone: data.user.phone } });
      }
      // Get Latest Token Data
      if (!token.dataValues) {
        token = await AccessToken.findOne({
          where: { user_id: user.dataValues.id }
        });
      }

      // 5 create response
      const responses = {
        user: {
          id: user.dataValues.id,
          registration_complete: user.dataValues.registration_complete,
          full_name: user.dataValues.full_name,
          email: user.dataValues.email,
          birthday: user.dataValues.birthday,
          phone: user.dataValues.phone
        },
        token: {
          access_token: token.dataValues.access_token,
          refresh_token: token.dataValues.refresh_token,
          expiry_in: token.dataValues.expiry_in
        }
      };

      return res
        .status(200)
        .json(response(true, 'User as employee successfully register', responses));
    } catch (error) {
      await transaction.rollback();
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = companyService;

const checkUser = async (data, transaction) => {
  let response = {
    errorMessage: '',
    user: ''
  };

  let user = await User.findOne({
    where: { phone: data.user.phone }
  });

  if (user) {
    if (!user.registration_complete) {
      // second parameter is salt for hash
      const hashPassword = crypt.hashSync(data.user.password, 15);
      const hash = crypt.hashSync(new Date().toString() + data.user.email, 10);
      const payload = Object.assign(
        {},
        {
          full_name: data.user.full_name,
          email: data.user.email,
          birthday: data.user.birthday,
          password: hashPassword,
          hash,
          is_phone_confirmed: 1,
          phone: data.user.phone
        }
      );
      const updateUser = await User.update(payload, {
        where: { phone: data.user.phone },
        transaction
      });
      if (!updateUser) {
        await transaction.rollback();
        response.errorMessage = 'Pendaftaran gagal dilakukan';
        return response;
      }
      response.user = user.dataValues.id;
    } else {
      response.errorMessage = 'Akun sudah terdaftar. Mohon coba lagi dengan nomor ponsel lain.';
      return response;
    }
  } else {
    // second parameter is salt for hash
    const hashPassword = crypt.hashSync(data.user.password, 15);
    const hash = crypt.hashSync(new Date().toString() + data.user.email, 10);
    const payload = Object.assign(
      {},
      {
        full_name: data.user.full_name,
        email: data.user.email,
        birthday: data.user.birthday,
        password: hashPassword,
        hash,
        is_phone_confirmed: 1,
        phone: data.user.phone
      }
    );

    user = await User.create(payload, { transaction });
    if (!user) {
      await transaction.rollback();
      response.errorMessage = 'Pendaftaran gagal dilakukan';
      return response;
    }
    response.user = user;
  }
  return response;
};

const checkCompany = async (data, transaction) => {
  let response = {
    errorMessage: '',
    company: ''
  };
  const existingName = data.company.company_name ? data.company.company_name : data.company.name;
  let finalCode;
  let company;

  let codeName = existingName
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
      company_name: data.company.company_name ? data.company.company_name : null,
      active: 1
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
    company = companyExist.id;
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
      response.errorMessage = 'Gagal membuat perusahaan baru';
      return response;
    }
    const payload = Object.assign({}, data, {
      company_name: data.company.company_name ? data.company.company_name : null,
      name: data.company.name,
      unique_id: data.company.unique_id,
      address: data.company.address,
      phone: data.company.phone,
      location: data.company.location,
      codename: finalCode,
      parent_company_id: parentCompany.dataValues.id,
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

const checkDigitalAsset = async (data, company, transaction) => {
  let response = {
    errorMessage: ''
  };
  let digitalCompany = await DigitalAsset.findOne({
    where: {
      uploadable_type: 'companies',
      uploadable_id: company.dataValues ? company.dataValues.id : company
    }
  });

  if (digitalCompany) {
    const payload = Object.assign(
      {},
      {
        url: data.company.url,
        type: 'avatar',
        uploadable_type: 'companies',
        uploadable_id: company.dataValues ? company.dataValues.id : company
      }
    );
    digitalCompany = await DigitalAsset.update(payload, {
      where: {
        uploadable_type: 'companies',
        uploadable_id: company.dataValues ? company.dataValues.id : company
      },
      transaction
    });
    if (!digitalCompany) {
      await transaction.rollback();
      response.errorMessage = 'Gagal membuat perusahaan baru';
      return response;
    }
  } else {
    const payload = Object.assign(
      {},
      {
        url: data.company.url,
        type: 'avatar',
        uploadable_type: 'companies',
        uploadable_id: company.dataValues ? company.dataValues.id : company
      }
    );
    digitalCompany = await DigitalAsset.create(payload, { transaction });
    if (!digitalCompany) {
      await transaction.rollback();
      response.errorMessage = 'Gagal membuat perusahaan baru';
      return response;
    }
  }
  return response;
};

const checkToken = async (data, user, transaction) => {
  let response = {
    errorMessage: '',
    data: ''
  };
  const expires = 60 * 60;
  let createAccessToken;

  const token = jwtHelpers.createJWT(
    Object.assign({
      email: data.user.email,
      id: user.dataValues ? user.dataValues.id : user,
      full_name: data.user.full_name
    }),
    config.authentication.secret,
    expires
  );

  const payload = {
    access_token: token,
    refresh_token: jwtHelpers.refreshToken(),
    provider: 'account-kit',
    user_id: user.dataValues ? user.dataValues.id : user,
    expiry_in: expires
  };

  let accessToken = await AccessToken.findOne({
    where: { user_id: user.dataValues ? user.dataValues.id : user }
  });

  if (!accessToken) {
    createAccessToken = await AccessToken.create(payload, { transaction });
  } else {
    createAccessToken = await AccessToken.update(payload, {
      where: { user_id: user.dataValues ? user.dataValues.id : user },
      transaction
    });
  }

  if (!createAccessToken) {
    response.errorMessage = 'Gagal membuat token';
    return response;
  }
  response.data = createAccessToken;
  return response;
};

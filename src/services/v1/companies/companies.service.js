require('module-alias/register');
const { response, nodemailerMail, mailTemplates, jwtHelpers } = require('@helpers');
const {
  companies: Company,
  employees: Employee,
  users: User,
  abilities: Ability,
  access_tokens: AccessToken,
  parent_companies: ParentCompany
} = require('@models');
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const config = require('config');

const EVENT = require('../../../eventemitter/constants');
const { observe } = require('../../../eventemitter');

const companyService = {
  get: async (req, res) => {
    const { id: user_id } = res.local.users;
    let employeeJoin;
    try {
      if (req.query.codename) {
        const { codename } = req.query;
        const isCompany = await Company.findOne({
          where: { codename },
          attributes: { exclude: ['created_at', 'updated_at'] }
        });
        if (!isCompany) {
          return res.status(400).json(response(false, 'Company code tidak ditemukan'));
        }

        employeeJoin = await Employee.findOne({
          where: { user_id, company_id: isCompany.id, flag: 1 }
        });
        if (!employeeJoin) {
          const payloadEmployee = Object.assign(
            {},
            {
              company_id: isCompany.id,
              user_id,
              role: 2,
              salary: 0,
              workdays: 0,
              daily_salary: 0,
              flag: 2,
              gajiandulu_status: 0,
              active: 1
            }
          );

          employeeJoin = await Employee.create(payloadEmployee);
        } else {
          await Employee.update({ flag: 3 }, { where: { user_id } });
        }

        // Insert Ability Record
        await Ability.create({ employee_id: employeeJoin.id });

        // Set user data status to completed register
        await User.update({ registration_complete: 1 }, { where: { id: user_id } });

        isCompany.dataValues.employee_id = employeeJoin.id;
        isCompany.dataValues.role = employeeJoin.role;
        isCompany.dataValues.userActive = employeeJoin.active;
        isCompany.dataValues.token = null;
        isCompany.dataValues.refresh_token = null;
        // CREATE NEW TOKEN IF USER IS ALREADY REGISTERED, BUT NOT BELONGS TO ANY COMPANY
        if (req.query.status === 'rejected') {
          const expires = 24 * 60 * 60;
          let accessToken = await AccessToken.findOne({
            where: {
              user_id,
              [Op.or]: [{ client_id: null }, { client_id: 'app' }]
            }
          });
          const user = await User.findOne({ where: { id: user_id } });
          const token = jwtHelpers.createJWT(
            Object.assign({
              email: user.email,
              phone: user.phone,
              id: user.id,
              employeeId: employeeJoin.id,
              employeeRole: employeeJoin.role
            }),
            config.authentication.secret,
            expires
          );
          const payload = {
            access_token: token,
            refresh_token: jwtHelpers.refreshToken(),
            provider: 'local',
            user_id: user.id,
            expiry_in: expires,
            client_id: 'app'
          };

          if (!accessToken) {
            await AccessToken.create(payload);
          } else {
            await AccessToken.update(payload, {
              where: {
                user_id: user.id,
                [Op.or]: [{ client_id: null }, { client_id: 'app' }]
              }
            });
          }
          isCompany.dataValues.token = token;
          isCompany.dataValues.refresh_token = payload.refresh_token;
        }

        //Emit the events
        observe.emit(EVENT.SEND_WELCOME, {
          userId: user_id,
          employeeId: employeeJoin.id
        });
        observe.emit(EVENT.NEW_EMPLOYEE_JOINED, {
          userId: user_id,
          employeeId: employeeJoin.id,
          companyId: isCompany.id
        });

        return res
          .status(200)
          .json(response(true, 'Company has been successfully retrieved', isCompany));
      }
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  patch: async (req, res) => {
    const { data } = req.body;
    const { company_id } = req.params;
    try {
      let updateCompany = await Company.findOne({ where: { id: company_id } });
      if (!updateCompany) {
        return res.status(400).json(response(false, `Company with id ${company_id} is not found`));
      }

      let finalCode;
      const existingName = data.company_name ? data.company_name : data.name;
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
      const isCodenameSame = await Company.findOne({
        where: { codename: { [Op.regexp]: `${codeName}[:0-9:]` }, id: company_id }
      });

      if (!isCodenameSame) {
        const companyExist = await Company.findOne({
          order: [['codename', 'DESC']],
          where: { codename: { [Op.regexp]: `${codeName}[:0-9:]` } }
        });

        if (companyExist) {
          let lastNums = companyExist.codename.substr(-3);
          lastNums = parseInt(lastNums);
          lastNums++;
          lastNums = ('0000' + lastNums).substr(-3);
          finalCode = codeName + lastNums;
        } else {
          const lastNum = '001';
          finalCode = codeName + lastNum;
        }
        Object.assign(data, {
          codename: finalCode
        });
      }
      Object.assign(data, {
        company_name: data.company_name ? data.company_name : null
      });

      updateCompany = await Company.update(data, {
        where: { id: company_id }
      });
      if (!updateCompany) {
        return res
          .status(400)
          .json(response(false, `Nothing changed in Company with id ${company_id}`));
      }

      updateCompany = await Company.findOne({ where: { id: company_id } });
      return res
        .status(200)
        .json(response(true, 'Company has been successfully updated', updateCompany));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  create: async (req, res) => {
    const { data } = req.body;
    // res.local.users from auth middleware
    // check src/helpers/auth.js

    try {
      const existingName = data.company_name ? data.company_name : data.name;
      let finalCode;
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
        where: { codename: { [Op.regexp]: `${codeName}[:0-9:]` }, registration_complete: 0 }
      });

      if (companyExist) {
        const payload = Object.assign({}, data, {
          company_name: data.company_name ? data.company_name : null,
          active: 1
        });
        const updateExistedCompany = await Company.update(payload, {
          where: { id: companyExist.id }
        });
        if (updateExistedCompany) {
          const getCompany = await Company.findOne({
            where: { id: companyExist.id }
          });
          return res
            .status(201)
            .json(response(true, 'Company has been successfully created', getCompany));
        }
      } else {
        const isCodenameUsed = await Company.findOne({
          order: [['codename', 'DESC']],
          where: { codename: { [Op.regexp]: `${codeName}[:0-9:]` } }
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

        const parentCompany = await ParentCompany.create({
          active: 1,
          company_name: data.name
        });

        const payload = Object.assign({}, data, {
          company_name: data.company_name ? data.company_name : null,
          codename: finalCode,
          parent_company_id: parentCompany.id,
          active: 1
        });
        const company = await Company.create(payload);
        if (company) {
          return res
            .status(201)
            .json(response(true, 'Company has been successfully created', company));
        }
      }
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  // Admin Access
  emailReminder: async (req, res) => {
    const { data } = req.body;
    try {
      const EmployeeList = await Employee.findAll({
        where: { company_id: req.params.company_id, role: 1 },
        include: { model: User, attributes: ['email'] }
      });

      const emailManager = [];
      for (let i = 0; i < EmployeeList.length; i++) {
        emailManager.push(EmployeeList[i].user.email);
      }

      /* eslint-disable */
      nodemailerMail.sendMail(
        {
          from: 'cs@atenda.id',
          to: emailManager, // An array if you have multiple recipients.
          subject: 'Pemberitahuan Blokir Team - Atenda',
          //You can use "html:" to send HTML email content. It's magic!
          html: mailTemplates.companyReminder({ data })
        },
        async function(err, info) {
          if (err) {
            let errorLog = new Date().toISOString() + ' : ' + err + '\n';
            global.emailErrorLog.write(errorLog);
            return res.status(400).json(response(false, 'Failed to send email'));
          } else {
            return res.status(200).json(response(true, 'Success to send email'));
          }
        }
      );
      /* eslint-enable */
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};

module.exports = companyService;

require('module-alias/register');
const { access_tokens: accessTokenModel } = require('@models');
const response = require('./response');
const jwtHelpers = require('./jwt');
const Sequelize = require('sequelize');
const { Op } = Sequelize;

const auth = async (req, res, next) => {
  // const { authorization, version } = req.headers;
  const { authorization } = req.headers;

  if (!authorization) {
    return res.status(403).json(response(false, 'Authorization header is not present'));
  }

  // if (version < '2.1.4') {
  //   return res.status(426).json(response(false, 'App version is not up-to date'));
  // }

  try {
    const token = jwtHelpers.parseToken(authorization);
    const accessToken = await accessTokenModel.findOne({
      where: { access_token: token, [Op.or]: [{ client_id: null }, { client_id: 'app' }] }
    });
    if (!accessToken) {
      return res.status(403).json(response(false, 'Please do login to get a valid access_token'));
    }
    const user = jwtHelpers.verifyJWT(token);
    res.local = {};

    if (user.full_name) {
      // AccessToken from OTP
      if (!user.id) {
        return res.status(403).json(response(false, 'Wrong token'));
      }
    } else {
      // AccessToken from normal login
      if (!user.phone || !user.id || !user.employeeId || !user.employeeRole) {
        if (!accessToken) {
          return res.status(403).json(response(false, 'Wrong token'));
        }
      }
    }

    // Later if you need user email or id
    // just get res.local.users
    res.local.users = {
      email: user.email,
      phone: user.phone,
      id: user.id,
      employeeId: user.employeeId,
      employeeRole: user.employeeRole,
      companyParentId: user.companyParentId
    };
  } catch (error) {
    return res.status(401).json(response(false, error.message));
  }
  next();
};

module.exports = auth;

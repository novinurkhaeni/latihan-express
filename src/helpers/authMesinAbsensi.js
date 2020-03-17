require('module-alias/register');
const { access_tokens: accessTokenModel } = require('@models');
const response = require('./response');
const jwtHelpers = require('./jwt');

const auth = async (req, res, next) => {
  const { authorization } = req.headers;

  if (!authorization) {
    return res.status(403).json(response(false, 'Authorization header is not present'));
  }

  try {
    const token = jwtHelpers.parseToken(authorization);
    const accessToken = await accessTokenModel.findOne({
      where: { access_token: token, client_id: 'mesin-absensi' }
    });
    if (!accessToken) {
      return res.status(403).json(response(false, 'Please do login to get a valid access_tokens'));
    }
    const user = jwtHelpers.verifyJWT(token);
    res.local = {};

    if (user.full_name) {
      // AccessToken from OTP
      if (!user.id || !user.email) {
        return res.status(403).json(response(false, 'Wrong token'));
      }
    } else {
      // AccessToken from normal login
      if (!user.email || !user.phone || !user.id || !user.employeeId || !user.employeeRole) {
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
      employeeRole: user.employeeRole
    };
  } catch (error) {
    return res.status(401).json(response(false, error.message));
  }
  next();
};

module.exports = auth;

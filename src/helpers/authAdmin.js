require('module-alias/register');
const { admin_access_tokens: AdminTokenModel } = require('@models');
const response = require('./response');
const jwtHelpers = require('./jwt');

const authAdmin = async (req, res, next) => {
  const { authorization } = req.headers;

  if (!authorization) {
    return res.status(403).json(response(false, 'Authorization header is not present'));
  }

  try {
    const token = jwtHelpers.parseToken(authorization);
    const accessToken = await AdminTokenModel.findOne({
      where: { access_token: token }
    });
    if (!accessToken) {
      return res.status(403).json(response(false, 'Please do login to get a valid access_token'));
    }

    const admin = jwtHelpers.verifyJWT(token);
    res.local = {};

    if (!admin.full_name || !admin.roles || !admin.email || !admin.id) {
      if (!accessToken) {
        return res.status(403).json(response(false, 'Wrong token'));
      }
    }

    // Later if you need admin email or id
    // just get res.local.admins
    res.local.admins = {
      full_name: admin.full_name,
      roles: admin.roles,
      email: admin.email,
      id: admin.id
    };
  } catch (error) {
    return res.status(403).json(response(false, error.message));
  }
  next();
};

module.exports = authAdmin;

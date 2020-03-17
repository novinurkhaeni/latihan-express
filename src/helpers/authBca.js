require('module-alias/register');
const { bca_access_tokens: BcaAccessToken } = require('@models');
const response = require('./response');
const jwtHelpers = require('./jwt');

const authAdmin = async (req, res, next) => {
  const { authorization } = req.headers;

  if (!authorization) {
    return res.status(403).json(response(false, 'Authorization header is not present'));
  }

  try {
    let token = jwtHelpers.parseToken(authorization);
    const accessToken = await BcaAccessToken.findOne({
      where: { access_token: token }
    });
    if (!accessToken) {
      return res.status(403).json(response(false, 'Your token is not valid'));
    }

    token = jwtHelpers.verifyJWT(token);
    res.local = {};

    if (!token.client_id) {
      return res.status(403).json(response(false, 'Wrong token'));
    }
  } catch (error) {
    return res.status(403).json(response(false, error.message));
  }
  next();
};

module.exports = authAdmin;

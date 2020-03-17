const jwt = require('jsonwebtoken');
const config = require('config');

const options = {
  expiresIn: 365 * 24 * 60 * 60,
  issuer: 'bibitnomic-api',
  jwtid: 'bibitnomic.user',
  subject: 'bibitnomic-access-token'
};

const jwtHelpers = {
  /**
   * Sign new jwt token from passed data.
   * @param {Object} data
   */
  createJWT: (data, secret, expires) => {
    if (expires) {
      options.expiresIn = expires;
    }
    try {
      const token = jwt.sign(data, secret, options);
      return token;
    } catch (error) {
      throw Error(error.message);
    }
  },

  /**
   * parse JWT with specified options.
   * @param {String} token
   */
  verifyJWT: token => {
    try {
      return jwt.verify(token, config.authentication.secret, options);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        error.message = 'Login token expired, please refresh token or do login again.';
      }
      throw Error(error.message);
    }
  },

  /**
   * Parse authorization header
   * @param {String} token
   */
  parseToken: authToken => {
    let token;
    if ((token = authToken.split(' ')[1])) {
      return token;
    }
    throw Error('invalid token');
  },

  refreshToken: () =>
    Math.random()
      .toString(36)
      .substring(3)
};

module.exports = jwtHelpers;

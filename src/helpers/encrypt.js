const crypto = require('crypto');

function encrypt(text) {
  var cipher = crypto.createCipher('aes-256-cbc', 'd6F3Efeq');
  var crypted = cipher.update(text, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return crypted;
}

module.exports = encrypt;

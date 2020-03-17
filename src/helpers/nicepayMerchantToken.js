const sha256 = require('js-sha256');

const generateNicepayMercToken = async (iMid, mkey, referenceNo, amount) => {
  if (process.env.NODE_ENV === 'production') {
    return sha256(iMid + referenceNo + amount + mkey);
  } else {
    return '32a387a936073a318017e4b409e11a1178222848d78b6b3d093456b947e6d3a1';
  }
};

module.exports = generateNicepayMercToken;

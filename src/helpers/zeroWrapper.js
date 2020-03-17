const zeroWrapper = value => {
  const zeroString = '000000';
  return zeroString.substring((value + '').length, 6) + value;
};
module.exports = zeroWrapper;

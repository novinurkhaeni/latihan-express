const formatCurrency = number => {
  if (isNaN(number)) {
    return number;
  }
  return number.toFixed().replace(/(\d)(?=(\d{3})+(,|$))/g, '$1.');
};

module.exports = formatCurrency;

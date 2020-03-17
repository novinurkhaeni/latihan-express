const dateTimeConverter = date => {
  const formatedDate = new Date(date);
  const newDate = `${formatedDate.getFullYear()}-${('0' + (formatedDate.getMonth() + 1)).slice(
    -2
  )}-${('0' + formatedDate.getDate()).slice(-2)} ${('0' + formatedDate.getHours()).slice(-2)}:${(
    '0' + formatedDate.getMinutes()
  ).slice(-2)}:${('0' + formatedDate.getSeconds()).slice(-2)}`;
  return newDate;
};

module.exports = dateTimeConverter;

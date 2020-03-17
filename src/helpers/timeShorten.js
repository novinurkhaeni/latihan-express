const timeShorten = date => {
  const formatedDate = new Date(date);
  const newTime = `${('0' + formatedDate.getHours()).slice(-2)}:${(
    '0' + formatedDate.getMinutes()
  ).slice(-2)}`;
  return newTime;
};

module.exports = timeShorten;

const dateGenerator = (startDate, endDate) => {
  const workDateStart = new Date(startDate);
  const workDateEnd = new Date(endDate);
  const rangedDate = [];
  while (workDateStart <= workDateEnd) {
    rangedDate.push(
      `${workDateStart.getFullYear()}-${('0' + (workDateStart.getMonth() + 1)).slice(-2)}-${(
        '0' + workDateStart.getDate()
      ).slice(-2)}`
    );
    workDateStart.setDate(workDateStart.getDate() + 1);
  }
  return rangedDate;
};

module.exports = dateGenerator;

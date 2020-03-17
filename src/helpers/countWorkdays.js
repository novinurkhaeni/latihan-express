const countWorkdays = (data, dateStart, dateEnd) => {
  let totalWorkDays = 0;
  let dailyFrequent = data;
  // GENERATE DATE IN A GIVEN RANGE DATE
  let rangedDate = [];
  const workDateStart = new Date(dateStart);
  const workDateEnd = new Date(dateEnd);
  while (workDateStart <= workDateEnd) {
    rangedDate.push(
      `${workDateStart.getFullYear()}-${('0' + (workDateStart.getMonth() + 1)).slice(-2)}-${(
        '0' + workDateStart.getDate()
      ).slice(-2)}`
    );
    workDateStart.setDate(workDateStart.getDate() + 1);
  }
  dailyFrequent = dailyFrequent.split(',');
  rangedDate.forEach(date => {
    const workDate = new Date(date);
    const index = dailyFrequent.findIndex(day => day === workDate.getDay().toString());
    if (index !== -1) {
      totalWorkDays++;
    }
  });
  return totalWorkDays;
};

module.exports = countWorkdays;

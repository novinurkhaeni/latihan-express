const getTotalDaysInCurrentMonth = date => {
  let now = new Date(date).setHours(new Date().getHours() + 7);
  now = new Date(now);
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
};

const getRangedDate = date => {
  let rawDateStart;
  let rawDateEnd;
  const payrollDate = date !== null ? date : 0;
  let currentDate = new Date().setHours(new Date().getHours() + 7);
  let lastMonth = new Date().setMonth(new Date().getMonth() - 1);
  currentDate = new Date(currentDate);
  lastMonth = new Date(lastMonth).setHours(new Date().getHours() + 7);
  const lastMonthStart = new Date(lastMonth).setDate(
    payrollDate !== 0 ? payrollDate : getTotalDaysInCurrentMonth(lastMonth)
  );
  const lastMonthEnd = new Date(lastMonth).setDate(
    payrollDate !== 0
      ? payrollDate + getTotalDaysInCurrentMonth(lastMonth) - 1
      : getTotalDaysInCurrentMonth(lastMonth) * 2 - 1
  );
  if (new Date(lastMonthStart) <= currentDate && new Date(lastMonthEnd) >= currentDate) {
    rawDateStart = lastMonthStart;
    rawDateEnd = lastMonthEnd;
  } else {
    rawDateStart = currentDate.setDate(
      payrollDate !== 0 ? payrollDate : getTotalDaysInCurrentMonth(currentDate)
    );
    rawDateEnd = currentDate.setDate(
      payrollDate !== 0
        ? payrollDate + getTotalDaysInCurrentMonth(currentDate) - 1
        : getTotalDaysInCurrentMonth(currentDate) * 2
    );
  }
  const start = new Date(rawDateStart);
  const end = new Date(rawDateEnd);

  const dateStart = `${start.getFullYear()}-${
    (start.getMonth() + 1).toString().length === 2
      ? start.getMonth() + 1
      : `0${start.getMonth() + 1}`
  }-${start.getDate().toString().length === 2 ? start.getDate() : `0${start.getDate()}`}`;

  const dateEnd = `${end.getFullYear()}-${
    (end.getMonth() + 1).toString().length === 2 ? end.getMonth() + 1 : `0${end.getMonth() + 1}`
  }-${end.getDate().toString().length === 2 ? end.getDate() : `0${end.getDate()}`}`;

  return { dateStart, dateEnd };
};

module.exports = {
  getTotalDaysInCurrentMonth,
  getRangedDate
};

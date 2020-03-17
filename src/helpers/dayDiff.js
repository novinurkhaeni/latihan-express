function dayDiff(date1, date2) {
  const startDate = new Date(date1);
  const endDate = new Date(date2);
  const ONE_DAY = 1000 * 60 * 60 * 24;
  const differenceMs = Math.abs(startDate - endDate);
  return Math.round(differenceMs / ONE_DAY);
}

module.exports = dayDiff;

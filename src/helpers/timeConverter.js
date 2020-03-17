const timeConverter = hours => {
  const workHour = hours.toFixed(2);
  let finalWorkHour = '';
  const workHourArray = workHour.split('.');
  const hour = workHourArray[0];
  if (hour === '0') {
    finalWorkHour = `${Math.round(hours * 60)} Menit`;
  } else if (workHourArray[1] === '00') {
    finalWorkHour = `${hour} Jam`;
  } else {
    const minute = workHour.replace(hour, 0);
    finalWorkHour = `${hour} Jam ${(parseFloat(minute) * 60).toFixed(0)} Menit`;
  }
  return finalWorkHour;
};

module.exports = timeConverter;

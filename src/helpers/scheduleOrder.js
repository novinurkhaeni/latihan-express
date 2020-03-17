require('module-alias/register');
const timeShorten = require('./timeShorten');

const scheduleOrder = data => {
  const date = new Date();
  let todaySchedule = data;
  let extendedSchedule = [];
  let sortParam = {
    first: -1,
    second: 1
  };
  let hourDeviation = 0;
  // Set Additional Hour for Schedule End Time Expansion
  const additionalHour = 1;
  date.setHours(date.getHours() + 7);
  const findExtendSchedule = todaySchedule.find(val => val.dataValues.start_time_info);
  if (findExtendSchedule) {
    const addHour = findExtendSchedule.dataValues.start_time_info ? additionalHour : 0;
    const shiftEndTime = findExtendSchedule.shift.schedule_shift.end_time.split(':');
    const endTime = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      parseInt(shiftEndTime[0]) + addHour,
      shiftEndTime[1]
    );
    if (date < endTime)
      sortParam = {
        first: 1,
        second: -1
      };
  }
  todaySchedule.sort((prev, next) => {
    // Sort By Clock ASC
    if (prev.shift) {
      if (prev.shift.schedule_shift.start_time < next.shift.schedule_shift.start_time)
        return sortParam.first;
      if (prev.shift.schedule_shift.start_time > next.shift.schedule_shift.start_time)
        return sortParam.second;
    } else {
      if (prev.start_time || prev.presence_start < next.start_time || next.presence_start)
        return sortParam.first;
      if (prev.start_time || prev.presence_start > next.start_time || next.presence_start)
        return sortParam.second;
    }
  });
  // Create Extended Version of Schedule
  extendedSchedule = [...todaySchedule];
  extendedSchedule.map((val, index) => {
    let timeDeviation = 0;
    let shiftEndTime = val.shift
      ? val.shift.schedule_shift.end_time
      : val.end_time || val.presence_end;
    shiftEndTime = shiftEndTime.split(':');
    const endTime = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      shiftEndTime[0],
      shiftEndTime[1]
    );
    if (extendedSchedule.length > index + 1) {
      let shiftStartDate = extendedSchedule[index + 1].shift
        ? extendedSchedule[index + 1].shift.schedule_shift.start_time
        : extendedSchedule[index + 1].start_time || extendedSchedule[index + 1].presence_start;
      shiftStartDate = shiftStartDate.split(':');
      let latestDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        shiftStartDate[0],
        shiftStartDate[1]
      );
      // Reduce Latest Date Minute By 1
      latestDate = new Date(latestDate.setMinutes(latestDate.getMinutes() - 1));
      timeDeviation = Math.floor((latestDate - endTime) / (1000 * 60));
      const newEndTime = new Date(endTime.setMinutes(endTime.getMinutes() + timeDeviation));
      // Add new property extended end time
      val.extended_end_time = timeShorten(newEndTime);
    } else {
      const latestDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59);
      timeDeviation = Math.floor((latestDate - endTime) / (1000 * 60));
      const newEndTime = new Date(endTime.setMinutes(endTime.getMinutes() + timeDeviation));
      // Add new property extended end time
      val.extended_end_time = timeShorten(newEndTime);
    }
    return val;
  });

  extendedSchedule = extendedSchedule.filter(val => {
    const shiftEndTime = val.extended_end_time.split(':');
    const endTime = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      shiftEndTime[0],
      shiftEndTime[1]
    );
    return date < endTime;
  });
  // ---
  todaySchedule = todaySchedule.filter(val => {
    const addDate = val.dataValues.end_time_info ? val.shift.schedule_shift.is_tommorow : 0;
    const addHour = val.dataValues.start_time_info ? additionalHour : 0;
    let shiftEndTime = val.shift
      ? val.shift.schedule_shift.end_time
      : val.end_time || val.presence_end;
    shiftEndTime = shiftEndTime.split(':');
    const endTime = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + addDate,
      parseInt(shiftEndTime[0]) + addHour,
      shiftEndTime[1]
    );
    return date < endTime;
  });
  if (todaySchedule.length) {
    if (todaySchedule[0].shift) {
      if (
        todaySchedule[0].shift.schedule_shift.is_tommorow &&
        todaySchedule[0].dataValues.start_time_info
      ) {
        const addHour = todaySchedule[0].dataValues.start_time_info ? additionalHour : 0;
        const anchorDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0);
        const shiftEndTime = todaySchedule[0].shift.schedule_shift.end_time.split(':');
        const endTime = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          parseInt(shiftEndTime[0]) + addHour,
          shiftEndTime[1]
        );
        hourDeviation = Math.floor((endTime - anchorDate) / 36e5);
      }
    }
  }

  return { hourDeviation, todaySchedule, extendedSchedule };
};

module.exports = scheduleOrder;

/* eslint-disable indent */
require('module-alias/register');
const {
  companies: Company,
  employees: Employee,
  users: User,
  presences: Presence,
  digital_assets: DigitalAsset
} = require('@models');
const {
  response,
  scheduleTemplates: scheduleTemplatesHelpers,
  definedSchedules: definedSchedulesHelpers
} = require('@helpers');

class ListingSchedulePresence {
  constructor(req, res) {
    this.req = req;
    this.res = res;
  }

  async getListingSchedulePresence() {
    const { company_id: companyId } = this.req.params;
    const { date } = this.req.query;
    const { employeeId } = this.res.local.users;
    const companyIdArr = companyId.split(',');

    try {
      const members = [];
      const userData = await Employee.findAll({
        attributes: ['id'],
        where: { company_id: companyIdArr },
        include: [
          {
            model: User,
            attributes: ['id', 'full_name']
          },
          {
            model: Presence,
            separate: true,
            where: {
              presence_date: date
            },
            required: false
          },
          {
            model: DigitalAsset,
            required: false,
            attributes: ['url', 'type'],
            where: {
              type: 'avatar'
            },
            as: 'assets'
          },
          {
            model: Company,
            required: false,
            attributes: ['company_name']
          }
        ]
      });

      const companyData = await Company.findAll({
        where: {
          id: companyIdArr
        }
      });

      if (companyData.length <= 0) {
        return this.res
          .status(400)
          .json(response(false, `Failed to fetch: company data doesn't exist`));
      }
      const isMember = await Employee.findOne({
        where: { id: employeeId, role: 2, active: 1 }
      });
      const scheduleTemplates = await scheduleTemplatesHelpers(
        date,
        employeeId,
        companyIdArr,
        isMember
      );

      const definedSchedules = await definedSchedulesHelpers(
        date,
        companyIdArr,
        isMember && employeeId,
        false,
        false,
        true,
        false
      );
      const schedules = scheduleTemplates.concat(definedSchedules);
      if (!schedules || schedules.length <= 0) {
        return this.res.status(400).json(response(false, `Jadwal Tidak Ditemukan`));
      }

      let definedStartTime;
      let definedEndTime;
      let definedStart;
      let definedEnd;
      let scheduleObj;
      let scheduleArray = [];
      const today = new Date();
      for (let i = 0; i < schedules.length; i++) {
        // Handle Response from Schedule Created With V2
        if (schedules[i].shift) {
          let isDateTommorow = schedules[i].shift.schedule_shift.is_tommorow;
          definedStartTime = schedules[i].shift.schedule_shift.start_time.split(':');
          definedEndTime = schedules[i].shift.schedule_shift.end_time.split(':');
          definedStart = new Date(
            isDateTommorow ? today.getFullYear() : 0,
            isDateTommorow ? today.getMonth() : 0,
            isDateTommorow ? today.getDate() : 0,
            definedStartTime[0],
            definedStartTime[1],
            0
          );
          definedEnd = new Date(
            isDateTommorow ? today.getFullYear() : 0,
            isDateTommorow ? today.getMonth() : 0,
            isDateTommorow ? today.getDate() + 1 : 0,
            definedEndTime[0],
            definedEndTime[1],
            0
          );

          scheduleObj = {
            id: schedules[i].start_date ? schedules[i].id : false,
            defined_id: schedules[i].presence_date ? schedules[i].id : false,
            employee: schedules[i].employee
              ? {
                  id: schedules[i].employee.id,
                  full_name: schedules[i].employee.user.full_name,
                  assets: schedules[i].employee.assets
                }
              : null,
            defined_schedule:
              schedules[i].employee.defined_schedules.length < 1
                ? null
                : {
                    id: schedules[i].employee.defined_schedules[0].id
                  },
            schedule_date:
              schedules[i].presence_date === undefined ? null : schedules[i].presence_date,
            shift_name: schedules[i].shift.schedule_shift.shift_name,
            schedule_start: schedules[i].shift.schedule_shift.start_time,
            schedule_end: schedules[i].shift.schedule_shift.end_time,
            workhour: Math.abs(definedStart - definedEnd) / 36e5,
            start_time_info: schedules[i].dataValues.start_time_info || null,
            end_time_info: schedules[i].dataValues.end_time_info || null,
            note: schedules[i].notes ? schedules[i].notes.note : null,
            color: schedules[i].shift.schedule_shift.color
          };
          scheduleArray.push(scheduleObj);
        } else {
          // Handle Response from Schedule Created With V1
          definedStartTime = schedules[i].presence_start
            ? schedules[i].presence_start.split(':')
            : schedules[i].start_time.split(':');
          definedEndTime = schedules[i].presence_end
            ? schedules[i].presence_end.split(':')
            : schedules[i].end_time.split(':');
          definedStart = new Date(0, 0, 0, definedStartTime[0], definedStartTime[1], 0);
          definedEnd = new Date(0, 0, 0, definedEndTime[0], definedEndTime[1], 0);

          scheduleObj = {
            id: schedules[i].start_date ? schedules[i].id : false,
            defined_id: schedules[i].presence_date ? schedules[i].id : false,
            employee: {
              id: schedules[i].employee.id,
              full_name: schedules[i].employee.user.full_name,
              assets: schedules[i].employee.assets
            },
            defined_schedule:
              schedules[i].employee.defined_schedules.length < 1
                ? null
                : {
                    id: schedules[i].employee.defined_schedules[0].id
                  },
            schedule_date:
              schedules[i].presence_date === undefined ? null : schedules[i].presence_date,
            schedule_start: schedules[i].presence_start
              ? schedules[i].presence_start
              : schedules[i].start_time,
            schedule_end: schedules[i].presence_end
              ? schedules[i].presence_end
              : schedules[i].end_time,
            workhour: Math.abs(definedStart - definedEnd) / 36e5,
            start_time_info: null,
            end_time_info: null,
            color: schedules[i].shift ? schedules[i].shift.schedule_shift.color : null
          };
          scheduleArray.push(scheduleObj);
        }
      }
      scheduleArray.sort((prev, next) => {
        if (prev.employee === null) return -1;
        if (next.employee === null) return 1;
        // Sort By Clock ASC
        if (prev.schedule_start < next.schedule_start) return -1;
        if (prev.schedule_start > next.schedule_start) return 1;
        // Sort By Name ASC
        if (prev.employee && next.employee) {
          if (prev.employee.full_name < next.employee.full_name) return -1;
          if (prev.employee.full_name > next.employee.full_name) return 1;
        }
      });

      userData.sort((prev, next) => {
        // Sort By Branch Id ASC
        if (prev.company.id < next.company.id) return -1;
        if (prev.company.id > next.company.id) return 1;
        // Sort By Tanggal Masuk Kerja ASC
        if (prev.date_start_work < next.date_start_work) return -1;
        if (prev.date_start_work > next.date_start_work) return 1;
        // Sort By Name Id ASC
        if (prev.user.full_name < next.user.full_name) return -1;
        if (prev.user.full_name > next.user.full_name) return 1;
      });

      const idEmployeeArr = userData.map(data => data.id);

      const presenceArr = await Presence.findAll({
        where: {
          presence_date: date,
          employee_id: idEmployeeArr
        }
      });

      for (let i = 0; i < userData.length; i++) {
        const idEmployee = userData[i].user.id;
        const presence = presenceArr.find(src => src.employee_id == idEmployee);
        let dataSchedule;

        for (let i = 0; i < scheduleArray.length; i++) {
          const id = scheduleArray[i].employee.id;
          const result =
            id && id === idEmployee
              ? scheduleArray[i].employee.id === id
                ? scheduleArray[i]
                : null
              : null;
          dataSchedule = result;
        }

        let tagInfo;
        let prc_start;
        let prc_end;
        const sch_start = scheduleArray[0].schedule_start;
        const sch_end = scheduleArray[0].schedule_end;

        if (presence) {
          prc_start = presence.presence_start && presence.presence_start.substr(11, 5);
          prc_end = presence.presence_end && presence.presence_end.substr(11, 5);
        } else {
          prc_start = null;
          prc_end = null;
        }

        if (!presence) {
          tagInfo = 'not-presence-yet';
        } else if (presence.is_absence === 1) {
          tagInfo = 'not-presence';
        } else if (prc_start && !prc_end) {
          tagInfo = 'at-work';
        } else if (prc_start && prc_end) {
          tagInfo = 'done';
        }

        const data = Object.assign(
          {},
          {
            tag: tagInfo,
            user: {
              full_name: userData[i].user.full_name,
              avatar: userData[i].assets.length < 1 ? null : userData[i].assets.url
            },
            schedule: {
              schedule_template_id: dataSchedule && dataSchedule.id,
              defined_schedule_id:
                dataSchedule && dataSchedule.defined_schedule && dataSchedule.defined_schedule.id,
              start_time: prc_start !== null ? prc_start : sch_start,
              end_time: prc_start !== null ? (prc_end === null ? null : prc_end) : sch_end,
              branch: userData[i].company.company_name
            },
            presence: !presence
              ? null
              : {
                  id: presence.id,
                  is_custom_ceklok: presence.is_custom_presence === 0 ? false : true,
                  is_absence: presence.is_absence === 0 ? false : true,
                  is_leave: presence.is_leave === 0 ? false : true,
                  is_permit: presence.is_permit === 0 ? false : true,
                  presence_overdue: presence.presence_overdue,
                  home_early: presence.home_early,
                  overwork: presence.overwork,
                  rest_overdue: presence.rest_overdue
                }
          }
        );
        members.push(data);
      }

      const membersDefault = members.map(item => ({
        total_data: members.filter(val => val.tag === item.tag).length,
        ...item
      }));

      const sortBy = ['at-work', 'not-presence-yet', 'not-presence', 'done'];

      const customSort = ({ data, sortBy, sortField }) => {
        const sortByObject = sortBy.reduce(
          (obj, item, index) => ({
            ...obj,
            [item]: index
          }),
          {}
        );

        return data.sort((a, b) => sortByObject[a[sortField]] - sortByObject[b[sortField]]);
      };

      const membersSort = customSort({
        data: membersDefault,
        sortBy: sortBy,
        sortField: 'tag'
      });

      return this.res
        .status(200)
        .json(response(true, 'Data daftar jadwal kehadiran berhasil didapatkan!', membersSort));
    } catch (error) {
      if (error.errors) {
        return this.res.status(400).json(response(false, error.errors));
      }
      return this.res.status(400).json(response(false, error.message));
    }
  }
}
module.exports = ListingSchedulePresence;

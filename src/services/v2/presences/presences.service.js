require('module-alias/register');
const Sequelize = require('sequelize');
const {
  response,
  countTotalSchedule,
  scheduleTemplates: scheduleTemplatesHelpers,
  definedSchedules: definedSchedulesHelpers,
  dateProcessor
} = require('@helpers');
const { presenceOverdueCheck: presenceOverdueCheckV2 } = require('@helpers/v2');
const { presenceOverdueCheck: presenceOverdueCheckV1 } = require('@helpers');
const {
  employees: Employee,
  presences: Presence,
  employee_notes: EmployeeNote,
  journals: Journal,
  salary_groups: SalaryGroup,
  companies: Companies,
  company_settings: CompanySettings,
  users: User
} = require('@models');

const presenceService = {
  /*
   * Create manual presence data
   *
   */
  create: async (req, res) => {
    const { data } = req.body;
    const { company_id } = req.params;
    const presenceStart = req.query.type
      ? new Date(data.presence_start)
      : new Date(`${data.presence_start} +0700`);
    const presenceEnd = req.query.type
      ? new Date(data.presence_end)
      : new Date(`${data.presence_end} +0700`);
    const restStart = data.rest_start ? new Date(`${data.rest_start} +0700`) : null;
    const restEnd = data.rest_end ? new Date(`${data.rest_end} +0700`) : null;
    const startDate = `${presenceStart.getFullYear()}-${(
      '0' +
      (presenceStart.getMonth() + 1)
    ).slice(-2)}-${presenceStart.getDate()}`;
    const endDate = `${presenceEnd.getFullYear()}-${('0' + (presenceEnd.getMonth() + 1)).slice(
      -2
    )}-${presenceEnd.getDate()}`;
    let presence;
    let notes;
    let payloadArray = [];
    let payloadJournal = [];
    let payloadNotes = [];
    let salaryPerday;
    let warningMessage = [];
    let warningShiftMessage = [];

    try {
      const memberArray = data.member;

      const companyData = await Companies.findOne({
        where: { id: company_id },
        include: { model: CompanySettings, as: 'setting' }
      });

      const employeeData = await Employee.findAll({
        where: { id: memberArray },
        include: [
          { model: SalaryGroup, through: { attributes: ['id'] } },
          { model: User, attributes: ['full_name'] }
        ]
      });
      presence = await Presence.findAll({
        where: { employee_id: memberArray, presence_date: { $gte: startDate, $lte: endDate } }
      });
      if (presence.length) {
        return res
          .status(400)
          .json(response(false, 'Anggota terpilih ada yang sudah melakukan presensi', presence));
      }

      const start = new Date(data.presence_start);
      const end = new Date(data.presence_end);
      let arrayDate = [];
      while (start <= end) {
        arrayDate.push(
          `${start.getFullYear()}-${('0' + (start.getMonth() + 1)).slice(-2)}-${(
            '0' + start.getDate()
          ).slice(-2)}`
        );
        start.setDate(start.getDate() + 1);
      }
      for (let s = 0; s < arrayDate.length; s++) {
        for (let i = 0; i < memberArray.length; i++) {
          const newDate = new Date(arrayDate[s]);
          const presenceStarted = presenceStart.setFullYear(
            newDate.getFullYear(),
            newDate.getMonth(),
            newDate.getDate()
          );
          const presenceEnded = presenceEnd.setFullYear(
            newDate.getFullYear(),
            newDate.getMonth(),
            newDate.getDate()
          );
          const restStarted =
            restStart &&
            restStart.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
          const restEnded =
            restEnd &&
            restEnd.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
          payloadArray.push({
            employee_id: memberArray[i],
            presence_date: arrayDate[s],
            presence_start: new Date(presenceStarted),
            presence_end: new Date(presenceEnded),
            rest_start: restStart && new Date(restStarted),
            rest_end: restEnd && new Date(restEnded)
          });
        }
      }
      /*
       *  IF there absence or leaving
       */
      if (req.query.type) {
        if (req.query.type === 'leave' || req.query.type === 'holiday') {
          let type;
          for (let i = 0; i < payloadArray.length; i++) {
            let salaryMember = employeeData.find(data => data.id === payloadArray[i].employee_id);
            if (req.query.type === 'leave') {
              payloadArray[i].is_leave = 1;
              type = 'cuti';
            } else if (req.query.type === 'holiday') {
              payloadArray[i].is_holiday = 1;
              type = 'libur';
            }

            /**
             * Zero salary groups length indicates that user still use data from V1
             */
            if (!salaryMember.salary_groups.length) {
              payloadJournal.push({
                employee_id: payloadArray[i].employee_id,
                type: 'salary',
                debet: salaryMember.daily_salary,
                kredit: 0,
                description: `Gaji ${type} tanggal ${payloadArray[i].presence_date}`,
                created_at: new Date(payloadArray[i].presence_date),
                updated_at: new Date(payloadArray[i].presence_date)
              });
            } else {
              /**
               * Salary groups length more than one indicates user have new data from V2
               */
              let isScheduled = [];
              isScheduled = await scheduleTemplatesHelpers(
                payloadArray[i].presence_date,
                payloadArray[i].employee_id,
                company_id,
                true
              );
              if (!isScheduled.length) {
                isScheduled = await definedSchedulesHelpers(
                  payloadArray[i].presence_date,
                  payloadArray[i].employee_id
                );
              }
              if (salaryMember.salary_groups[0].salary_type === '1') {
                const rangedDate = dateProcessor.getRangedDate(companyData.setting.payroll_date);
                let countSchedule = await countTotalSchedule(
                  payloadArray[i].employee_id,
                  rangedDate.dateStart,
                  rangedDate.dateEnd
                );
                // ONLY ADD MONTHLY SALARY IF THERE IS AT LEAST ONE SCHEDULE AVAILABLE
                if (countSchedule) {
                  salaryPerday = salaryMember.salary_groups[0].salary / countSchedule;
                  payloadJournal.push({
                    employee_id: payloadArray[i].employee_id,
                    type: 'salary',
                    debet: salaryPerday,
                    kredit: 0,
                    description: `Gaji ${type} tanggal ${payloadArray[i].presence_date}`,
                    created_at: new Date(payloadArray[i].presence_date),
                    updated_at: new Date(payloadArray[i].presence_date)
                  });
                } else {
                  // COLLECT MEMBER NAME THAT DOESNT HAVE SCHEDULE AT ALL
                  warningMessage.push(salaryMember.user.full_name);
                }
              } else {
                // ONLY ADD SHIFT SALARY IF THERE IS SCHEDULE AVAILABLE IN CURRENT DATE
                if (isScheduled.length && isScheduled[0].shift) {
                  salaryPerday =
                    salaryMember.salary_groups[0].salary *
                    parseInt(isScheduled[0].shift.schedule_shift.shift_multiply);
                  payloadJournal.push({
                    employee_id: payloadArray[i].employee_id,
                    type: 'salary',
                    debet: salaryPerday,
                    kredit: 0,
                    description: `Gaji ${type} tanggal ${payloadArray[i].presence_date}`,
                    created_at: new Date(payloadArray[i].presence_date),
                    updated_at: new Date(payloadArray[i].presence_date)
                  });
                } else {
                  // COLLECT MEMBER NAME THAT DOESNT HAVE SCHEDULE FOR TODAY
                  warningShiftMessage.push(salaryMember.user.full_name);
                }
              }
            }
            delete payloadArray[i].presence_start;
            delete payloadArray[i].presence_end;
          }
          presence = await Presence.bulkCreate(payloadArray);

          const journal = await Journal.bulkCreate(payloadJournal);

          if (!journal) {
            return res
              .status(400)
              .json(response(false, 'Gagal mencatat presensi ke jurnal keuangan'));
          }

          let responseMessage = `Berhasil membuat presensi manual ${type}. `;
          let responsePayload = { showAlert: false };
          if (warningMessage.length) {
            let message;
            responsePayload.showAlert = true;
            const memberList = warningMessage.toString().replace(/,/g, ', ');
            const rangedDate = dateProcessor.getRangedDate(companyData.setting.payroll_date);
            message = `Anggota ${memberList} tidak mendapatkan gaji bulanan karena tidak ada jadwal sama sekali untuk ${
              warningMessage.length === 1 ? 'dia' : 'mereka'
            } di rentang tanggal ${rangedDate.dateStart} s/d ${rangedDate.dateEnd}. `;
            responseMessage = responseMessage.concat(message);
          }
          if (warningShiftMessage.length) {
            let message;
            const memberList = warningShiftMessage.toString().replace(/,/g, ', ');
            responsePayload.showAlert = true;
            if (warningMessage.length) {
              message = `Sedangkan untuk anggota ${memberList} tidak mendapatkan gaji shift karena tidak ada jadwal untuk ${
                warningShiftMessage.length === 1 ? 'dia' : 'mereka'
              } di antara tanggal ${arrayDate[0]} s/d ${arrayDate[arrayDate.length - 1]}`;
            } else {
              message = `Anggota ${memberList} tidak mendapatkan gaji shift karena tidak ada jadwal untuk ${
                warningShiftMessage.length === 1 ? 'dia' : 'mereka'
              } di antara tanggal ${arrayDate[0]} s/d ${arrayDate[arrayDate.length - 1]}`;
            }
            responseMessage = responseMessage.concat(message);
          }
          return res.status(200).json(response(true, responseMessage, responsePayload));
        } else if (req.query.type === 'absence') {
          for (let i = 0; i < payloadArray.length; i++) {
            payloadArray[i].is_absence = 1;
            delete payloadArray[i].presence_start;
            delete payloadArray[i].presence_end;
          }
          presence = await Presence.bulkCreate(payloadArray);

          return res
            .status(200)
            .json(
              response(true, 'Berhasil membuat presensi manual tidak masuk', { showAlert: false })
            );
        } else {
          return res.status(422).json(response(false, 'Wrong type request'));
        }
      }

      /*
       *  Check presence overdue
       */
      for (let i = 0; i < payloadArray.length; i++) {
        let presenceOverdue = 0;
        let salaryMember = employeeData.find(data => data.id === payloadArray[i].employee_id);

        if (!salaryMember.salary_groups.length) {
          // Zero salary groups length indicates that user still use data from V1
          presenceOverdue = await presenceOverdueCheckV1(
            new Date(`${payloadArray[i].presence_start} -0700`),
            payloadArray[i].employee_id
          );
        } else {
          // Salary groups length more than one indicates user have new data from V2
          presenceOverdue = await presenceOverdueCheckV2(
            new Date(`${payloadArray[i].presence_start} -0700`),
            payloadArray[i].employee_id
          );
        }

        const workHours =
          Math.abs(payloadArray[i].presence_start - payloadArray[i].presence_end) / 36e5;
        const overWorked = Math.floor(workHours - companyData.setting.overwork_limit);
        const overwork = overWorked < 0 ? 0 : overWorked;

        payloadArray[i].overwork = overwork;
        payloadArray[i].work_hours = workHours.toFixed(2);

        if (parseInt(presenceOverdue) > parseInt(companyData.setting.presence_overdue_limit)) {
          // Insert presence overdue if beyond threshold
          payloadArray[i].presence_overdue =
            presenceOverdue - companyData.setting.presence_overdue_limit;
        }

        /*
         *  Check rest overdue
         */
        let restOverdueCal = -1;

        if (restStart && restEnd) {
          const totalRest = Math.floor(
            Math.abs(payloadArray[i].rest_end - payloadArray[i].rest_start) / (1000 * 60)
          ); // minutes
          const totalRestHour =
            Math.abs(payloadArray[i].rest_end - payloadArray[i].rest_start) / 36e5; // hour
          restOverdueCal = Math.floor(totalRest - companyData.setting.rest_limit);

          payloadArray[i].work_hours = (workHours - totalRestHour).toFixed(2);
        }

        const restOverdue = restOverdueCal < 0 ? 0 : restOverdueCal;

        payloadArray[i].rest_overdue = restOverdue;

        if (!salaryMember.salary_groups.length) {
          // Zero salary groups length indicates that user still use data from V1
          payloadJournal.push({
            employee_id: payloadArray[i].employee_id,
            type: 'salary',
            debet: salaryMember.daily_salary_with_meal || salaryMember.daily_salary,
            kredit: 0,
            description: `Gaji masuk tanggal ${payloadArray[i].presence_date}`,
            created_at: new Date(payloadArray[i].presence_date),
            updated_at: new Date(payloadArray[i].presence_date),
            include_lunch_allowance: 1,
            include_transport_allowance: 1
          });
        } else {
          // Salary groups length more than one indicates user have new data from V2
          let isScheduled = [];
          isScheduled = await scheduleTemplatesHelpers(
            payloadArray[i].presence_date,
            payloadArray[i].employee_id,
            company_id,
            true
          );
          if (!isScheduled.length) {
            isScheduled = await definedSchedulesHelpers(
              payloadArray[i].presence_date,
              company_id,
              payloadArray[i].employee_id
            );
          }

          /*
           *  payload Journal
           */
          // Salary Type 1 Mean Bulanan
          const allowance =
            salaryMember.salary_groups[0].transport_allowance +
            salaryMember.salary_groups[0].lunch_allowance;

          if (salaryMember.salary_groups[0].salary_type === '1') {
            const rangedDate = dateProcessor.getRangedDate(companyData.setting.payroll_date);
            let countSchedule = await countTotalSchedule(
              payloadArray[i].employee_id,
              rangedDate.dateStart,
              rangedDate.dateEnd
            );
            // ONLY ADD SALARY IF THERE IS SCHEDULE AVAILABLE
            if (countSchedule) {
              salaryPerday = salaryMember.salary_groups[0].salary / countSchedule + allowance;
              payloadJournal.push({
                employee_id: payloadArray[i].employee_id,
                type: 'salary',
                debet: salaryPerday,
                kredit: 0,
                description: `Gaji masuk tanggal ${payloadArray[i].presence_date}`,
                created_at: new Date(payloadArray[i].presence_date),
                updated_at: new Date(payloadArray[i].presence_date),
                include_lunch_allowance: 1,
                include_transport_allowance: 1
              });
            } else {
              // COLLECT MEMBER NAME THAT DOESNT HAVE SCHEDULE
              warningMessage.push(salaryMember.user.full_name);
            }
            // Salary Type 2 Mean Shift
          } else {
            // ONLY ADD SHIFT SALARY IF THERE IS SCHEDULE AVAILABLE IN CURRENT DATE
            if (isScheduled.length && isScheduled[0].shift) {
              salaryPerday =
                salaryMember.salary_groups[0].salary *
                parseInt(isScheduled[0].shift.schedule_shift.shift_multiply);
              salaryPerday = salaryPerday + allowance;
              payloadJournal.push({
                employee_id: payloadArray[i].employee_id,
                type: 'salary',
                debet: salaryPerday,
                kredit: 0,
                description: `Gaji masuk tanggal ${payloadArray[i].presence_date}`,
                created_at: new Date(payloadArray[i].presence_date),
                updated_at: new Date(payloadArray[i].presence_date),
                include_lunch_allowance: 1,
                include_transport_allowance: 1
              });
            } else {
              // COLLECT MEMBER NAME THAT DOESNT HAVE SCHEDULE FOR TODAY
              warningShiftMessage.push(salaryMember.user.full_name);
            }
          }
        }

        if (data.bonus) {
          payloadJournal.push({
            employee_id: payloadArray[i].employee_id,
            type: 'other',
            debet: data.bonus,
            kredit: 0,
            description: `Bonus tanggal ${payloadArray[i].presence_date}`,
            created_at: new Date(payloadArray[i].presence_date),
            updated_at: new Date(payloadArray[i].presence_date)
          });
        }

        if (data.penalty) {
          payloadJournal.push({
            employee_id: payloadArray[i].employee_id,
            type: 'other',
            debet: 0,
            kredit: data.penalty,
            description: `Denda tanggal ${payloadArray[i].presence_date}`,
            created_at: new Date(payloadArray[i].presence_date),
            updated_at: new Date(payloadArray[i].presence_date)
          });
        }

        if (data.notes) {
          payloadNotes.push({
            employee_id: payloadArray[i].employee_id,
            date: payloadArray[i].presence_date,
            notes: data.notes,
            created_at: new Date(payloadArray[i].presence_date),
            updated_at: new Date(payloadArray[i].presence_date)
          });
        }
      }

      /*
       * Let's insert the data
       */
      presence = await Presence.bulkCreate(payloadArray);

      if (!presence) {
        return res.status(400).json(response(false, 'Gagal membuat presensi manual'));
      }

      const journal = await Journal.bulkCreate(payloadJournal);

      if (!journal) {
        return res.status(400).json(response(false, 'Gagal mencatat presensi ke jurnal keuangan'));
      }

      if (data.notes) {
        notes = await EmployeeNote.bulkCreate(payloadNotes);

        if (!notes) {
          return res.status(400).json(response(false, 'Gagal membuat catatan presensi'));
        }
      }
      let responseMessage = `Berhasil membuat presensi manual. `;
      let responsePayload = { showAlert: false };
      if (warningMessage.length) {
        let message;
        responsePayload.showAlert = true;
        const memberList = warningMessage.toString().replace(/,/g, ', ');
        const rangedDate = dateProcessor.getRangedDate(companyData.setting.payroll_date);
        message = `Anggota ${memberList} tidak mendapatkan gaji bulanan karena tidak ada jadwal sama sekali untuk ${
          warningMessage.length === 1 ? 'dia' : 'mereka'
        } di rentang tanggal ${rangedDate.dateStart} s/d ${rangedDate.dateEnd}. `;
        responseMessage = responseMessage.concat(message);
      }
      if (warningShiftMessage.length) {
        let message;
        const memberList = warningShiftMessage.toString().replace(/,/g, ', ');
        responsePayload.showAlert = true;
        if (warningMessage.length) {
          message = `Sedangkan untuk anggota ${memberList} tidak mendapatkan gaji shift karena tidak ada jadwal untuk ${
            warningShiftMessage.length === 1 ? 'dia' : 'mereka'
          } di antara tanggal ${arrayDate[0]} s/d ${arrayDate[arrayDate.length - 1]}`;
        } else {
          message = `Anggota ${memberList} tidak mendapatkan gaji shift karena tidak ada jadwal untuk ${
            warningShiftMessage.length === 1 ? 'dia' : 'mereka'
          } di antara tanggal ${arrayDate[0]} s/d ${arrayDate[arrayDate.length - 1]}`;
        }
        responseMessage = responseMessage.concat(message);
      }

      return res.status(200).json(response(true, responseMessage, responsePayload));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },

  /*
   * Delete presence data
   *
   */
  delete: async (req, res) => {
    const { presence_id: presenceId } = req.params;
    let presence;

    try {
      presence = await Presence.findOne({ where: { id: presenceId } });
      if (!presence) {
        return res.status(400).json(response(false, 'Tidak ditemukan data presensi'));
      }

      await Journal.destroy({
        where: [
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
            presence.presence_date
          ),
          { employee_id: presence.employee_id }
        ]
      });

      presence = await Presence.destroy({
        where: { id: presenceId },
        cascade: true
      });
      if (!presence) {
        return res.status(400).json(response(false, 'Tidak ada yang terhapus'));
      }

      return res.status(200).json(response(true, 'Berhasil menghapus presensi'));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  },
  patch: async (req, res) => {
    const { presence_id: presenceId } = req.params;
    const { data } = req.body;
    try {
      let presences = await Presence.findOne({
        where: { id: presenceId },
        include: { model: Employee }
      });
      if (!presences) {
        return res.status(400).json(response(false, 'Wrong id of presence, data not available'));
      }

      const employeeData = await Employee.findOne({
        where: { user_id: presences.employee.user_id },
        include: [
          {
            model: Companies,
            include: [{ model: CompanySettings, as: 'setting' }]
          },
          {
            model: SalaryGroup,
            through: { attributes: ['id'] }
          }
        ]
      });

      let work_hours;
      let overwork;
      let rest_overdue;
      let presenceOverdue = 0;
      let salaryPerday;

      let payload = Object.assign({}, data);
      if (data.presence_end || data.presence_start) {
        let restHour = 0;
        const presenceStart = data.presence_start ? new Date(`${data.presence_start} -0700`) : null;
        const presenceEnd = data.presence_end ? new Date(`${data.presence_end} -0700`) : null;

        if (presences.rest_start && presences.rest_end) {
          const restStart = new Date(presences.rest_start);
          const restEnd = new Date(presences.rest_end);
          restHour = Math.abs(restEnd - restStart) / 36e5;
        }

        if (!employeeData.salary_groups.length) {
          presenceOverdue = await presenceOverdueCheckV1(
            new Date(`${presenceStart ? presenceStart : presences.presence_start}`),
            employeeData.id
          );
        } else {
          presenceOverdue = await presenceOverdueCheckV2(
            new Date(`${presenceStart ? presenceStart : presences.presence_start}`),
            employeeData.id
          );
        }

        if (presences.presence_end) {
          const checkoutDate = new Date(`${presenceStart ? presences.presence_end : presenceEnd}`);
          const checkining = new Date(presenceStart ? presenceStart : presences.presence_start);
          work_hours = Math.abs(checkining - new Date(`${checkoutDate}`)) / 36e5;
          const overWorked = work_hours - restHour - employeeData.company.setting.overwork_limit;
          overwork = overWorked < 0 ? 0 : overWorked;

          payload = Object.assign(payload, {
            overwork: overwork,
            work_hours: (work_hours - restHour).toFixed(2)
          });
        }

        const countPresenceOverdue =
          presenceOverdue - employeeData.company.setting.presence_overdue_limit;

        // Assign Presence Overdue to Payload
        payload.presence_overdue =
          countPresenceOverdue > 0
            ? presenceOverdue - employeeData.company.setting.presence_overdue_limit
            : 0;

        /*
         *  payload Journal
         */
        if (presences.presence_end) {
          let payloadJournal;
          if (!employeeData.salary_groups.length) {
            payloadJournal = {
              employee_id: employeeData.id,
              type: 'salary',
              debet: employeeData.daily_salary_with_meal || employeeData.daily_salary,
              kredit: 0,
              description: `Gaji harian tanggal ${presences.presence_date}`,
              created_at: new Date(presences.presence_date),
              updated_at: new Date(presences.presence_date)
            };
          } else {
            const allowance =
              employeeData.salary_groups[0].transport_allowance +
              employeeData.salary_groups[0].lunch_allowance;

            // Salary Type 1 Mean Bulanan
            if (employeeData.salary_groups[0].salary_type === '1') {
              const rangedDate = dateProcessor.getRangedDate(
                employeeData.company.setting.payroll_date
              );
              let countSchedule = await countTotalSchedule(
                employeeData.id,
                rangedDate.dateStart,
                rangedDate.dateEnd
              );
              salaryPerday = employeeData.salary_groups[0].salary / countSchedule + allowance;

              payloadJournal = {
                employee_id: employeeData.id,
                type: 'salary',
                debet: salaryPerday,
                kredit: 0,
                description: `Gaji harian tanggal ${presences.presence_date}`,
                include_lunch_allowance: 1,
                include_transport_allowance: 1,
                created_at: new Date(presences.presence_date),
                updated_at: new Date(presences.presence_date)
              };
              // Salary Type 2 Mean Shift
            } else {
              let isScheduled = [];
              isScheduled = await scheduleTemplatesHelpers(
                presences.presence_date,
                employeeData.id,
                employeeData.company_id,
                true
              );
              if (!isScheduled.length) {
                isScheduled = await definedSchedulesHelpers(
                  presences.presence_date,
                  employeeData.id
                );
              }
              salaryPerday =
                employeeData.salary_groups[0].salary *
                parseInt(isScheduled[0].shift.schedule_shift.shift_multiply);
              salaryPerday = salaryPerday + allowance;
              payloadJournal = {
                employee_id: employeeData.id,
                type: 'salary',
                debet: salaryPerday,
                kredit: 0,
                description: `Gaji harian tanggal ${presences.presence_date}`,
                include_lunch_allowance: 1,
                include_transport_allowance: 1,
                created_at: new Date(presences.presence_date),
                updated_at: new Date(presences.presence_date)
              };
            }
          }

          let journal = await Journal.findOne({
            where: [
              { employee_id: employeeData.id, type: 'salary' },
              Sequelize.where(
                Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
                presences.presence_date
              )
            ]
          });

          if (!journal) {
            journal = await Journal.create(payloadJournal);
            if (!journal) {
              return res
                .status(400)
                .json(response(false, 'Gagal mencatat upah presensi ke jurnal keuangan'));
            }
          }
        }
        // WAITING ANSWER IF IT NEED UPDATED OR NOT WHEN CHANGING PRESENCES
        // else {
        //   journal = await Journal.update(payloadJournal, {
        //     where: Sequelize.where(
        //       Sequelize.fn(
        //         'DATE_FORMAT',
        //         Sequelize.col('created_at'),
        //         '%Y-%m-%d'
        //       ),
        //       presences.presence_date
        //     )
        //   });
        //   if (!journal) {
        //     return res
        //       .status(400)
        //       .json(
        //         response(
        //           false,
        //           'Gagal mencatat upah presensi ke jurnal keuangan'
        //         )
        //       );
        //   }
        // }
      }

      if (data.rest_end) {
        const restEnd = new Date(`${data.rest_end} -0700`);
        const started = new Date(presences.rest_start);
        const totalRest = Math.floor(Math.abs(restEnd - started) / (1000 * 60)); // minutes
        const totalRestHour = Math.abs(restEnd - started) / 36e5; // hour
        const checklog = {
          checkIn: new Date(presences.presence_start),
          checkOut: new Date(presences.presence_end)
        };
        const workHour = Math.abs(checklog.checkIn - checklog.checkOut) / 36e5;
        const restOverdue = Math.floor(totalRest - employeeData.company.setting.rest_limit);
        const overWorked = workHour - totalRestHour - employeeData.company.setting.overwork_limit;
        overwork = overWorked < 0 ? 0 : overWorked;
        rest_overdue = restOverdue < 0 ? 0 : restOverdue;
        payload = Object.assign(payload, {
          rest_overdue: rest_overdue,
          work_hours: (workHour - totalRestHour).toFixed(2),
          overwork
        });
      }

      presences = await Presence.update(payload, { where: { id: presenceId } });
      if (!presences) {
        return res.status(400).json(response(false, 'Presence data not updated'));
      }
      presences = await Presence.findOne({ where: { id: presenceId } });
      return res
        .status(200)
        .json(response(true, 'Presence data has been successfully updated', presences));
    } catch (error) {
      if (error.errors) {
        return res.status(400).json(response(false, error.errors));
      }
      return res.status(400).json(response(false, error.message));
    }
  }
};
module.exports = presenceService;

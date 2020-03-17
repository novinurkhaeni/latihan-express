const {
  periodic_pieces: PeriodicPiecesModel,
  journals: JournalModel,
  employee_notes: EmployeeNotesModel
} = require('@models');
const Sequelize = require('sequelize');
const { formatCurrency } = require('@helpers');

const EVENT = require('../constants');

class PeriodicPieces {
  constructor(observable) {
    this.observable = observable;
  }

  listenPeriodicPieces() {
    this.observable.addListener(EVENT.PERIODIC_PIECES, async () => {
      let today = new Date();
      today = new Date(`${today} -0700`);
      today = `${today.getFullYear()}-${('0' + (today.getMonth() + 1)).slice(-2)}-${(
        '0' + today.getDate()
      ).slice(-2)}`;
      const periodic = await PeriodicPiecesModel.findAll({
        where: [
          { start: { $lte: today }, end: { $gte: today } },
          Sequelize.literal(
            `CASE
            WHEN repeat_type = 'monthly'
            THEN (FLOOR(DATEDIFF(DATE_FORMAT(start, '%Y-%m-%d'), '${today}')/30 + 1) % 1) = 0 
            AND (DATE_FORMAT(start, '%d') = DATE_FORMAT('${today}', '%d'))
            WHEN repeat_type = 'weekly'
            THEN (FLOOR(DATEDIFF(DATE_FORMAT(DATE_SUB(start, INTERVAL (DAYOFWEEK(start) - 1) DAY), '%Y-%m-%d'), '${today}')/7 + 1) % 1) = 0
            AND (DAYOFWEEK(start) = DAYOFWEEK('${today}'))
            end`
          )
        ]
      });
      const payloadJournal = [];
      const payloadNotes = [];
      periodic.forEach(data => {
        const composeJournal = {
          employee_id: data.employee_id,
          type: 'periodic',
          debet: data.type === 1 ? data.amount : 0,
          kredit: data.type === 2 ? data.amount : 0,
          description: `${data.type === 1 ? 'Bonus' : 'Denda'} otomatis tanggal ${today}`
        };
        if (data.note) {
          const composeNotes = {
            employee_id: data.employee_id,
            type: data.type,
            date: today,
            notes:
              data.note ||
              `${data.type === 1 ? 'Bonus' : 'Potongan'} otomatis sebesar Rp. ${formatCurrency(
                data.amount
              )}`
          };
          payloadNotes.push(composeNotes);
        }
        payloadJournal.push(composeJournal);
      });
      await JournalModel.bulkCreate(payloadJournal);
      await EmployeeNotesModel.bulkCreate(payloadNotes);
    });
  }
}

module.exports = PeriodicPieces;

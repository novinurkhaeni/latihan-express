const { gql } = require('apollo-server-express');
const Sequelize = require('sequelize');
const {
  presences: Presence,
  employee_notes: EmployeeNote,
  journals: Journal,
  employees: Employee,
  companies: Company,
  company_settings: CompanySetting
} = require('@models');
const {
  errorHandler: { dbError },
  presenceOverdueCheck
} = require('@helpers');

// TypeDef of Presence
const typeDef = gql`
  extend type Query {
    presence(id: Int!): Presence!
    presences: [Presence]!
  }

  extend type Mutation {
    updatePresence(
      id: Int!
      employee_id: Int!
      presence_date: String
      presence_start: String
      presence_end: String
      rest_start: String
      rest_end: String
      bonus: Int
      penalty: Int
      notes_id: Int
      notes: String
      type: String
      description: String
      created_at: String
    ): String!
    deletePresence(id: Int!, presence_date: String!, employee_id: Int!): String!
  }

  type Presence {
    id: Int
    employee_id: Int
    presence_date: String
    presence_start: String
    presence_end: String
    rest_start: String
    rest_end: String
    presence_overdue: Int
    rest_overdue: Int
    is_absence: Int
    is_leave: Int
    overwork: Float
    work_hours: Float
    checkin_location: String
    checkout_location: String
    bonusPenalty: BonusPenalty
    notes: Notes
    created_at: String
    updated_at: String
  }

  type Notes {
    id: Int
    date: String
    notes: String
  }

  type BonusPenalty {
    bonus: Int
    penalty: Int
  }
`;

// Presence Resolvers
const resolvers = {
  Query: {
    presence: async (root, { id }) => {
      try {
        const result = await Presence.findOne({ where: { id } });
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    presences: async params => {
      const { limit, offset } = params;
      try {
        const result = await Presence.all({ limit, offset });
        return result;
      } catch (error) {
        dbError(error);
      }
    }
  },
  Mutation: {
    updatePresence: async (root, params) => {
      try {
        let presences = await Presence.findOne({
          where: { id: params.id },
          include: { model: Employee }
        });
        if (!presences) {
          throw new Error('Wrong id of presence, data not available');
        }
        const employeeData = await Employee.findOne({
          where: { user_id: presences.employee.user_id },
          include: [
            {
              model: Company,
              include: [{ model: CompanySetting, as: 'setting' }]
            }
          ]
        });

        let payloadPresence;
        payloadPresence = {
          presence_start: params.presence_start,
          presence_end: params.presence_end,
          rest_start: params.rest_start,
          rest_end: params.rest_end
        };

        if (params.bonus || params.penalty) {
          const payloadJournal = {
            employee_id: params.employee_id,
            type: params.type,
            debet: params.bonus ? params.bonus : 0,
            kredit: params.penalty ? params.penalty : 0,
            description: params.description,
            created_at: params.created_at
          };
          const updateJournals = await Journal.create(payloadJournal);
          if (updateJournals < 0) {
            throw new Error(`Failed to update journal for presence with id ${params.id}`);
          }
        }

        let work_hours;
        let overwork;
        let rest_overdue;

        // Insert Member Salary into Journal
        const presenceStart = new Date(`${params.presence_start} -0700`);
        const presenceEnd = new Date(`${params.presence_end} -0700`);
        const presenceOverdue = await presenceOverdueCheck(
          new Date(`${presenceStart}`),
          employeeData.id
        );
        work_hours = Math.floor(Math.abs(presenceStart - presenceEnd) / 36e5);
        const overWorked = Math.floor(work_hours - employeeData.company.setting.overwork_limit);
        overwork = overWorked < 0 ? 0 : overWorked;
        Object.assign(payloadPresence, {
          overwork: overwork,
          work_hours: work_hours
        });

        const countPresenceOverdue =
          presenceOverdue - employeeData.company.setting.presence_overdue_limit;

        // Assign Presence Overdue to Payload
        payloadPresence.presence_overdue =
          countPresenceOverdue > 0
            ? presenceOverdue - employeeData.company.setting.presence_overdue_limit
            : 0;
        /*
         *  payload Journal
         */
        const payloadJournal = {
          employee_id: employeeData.id,
          type: 'salary',
          debet: employeeData.daily_salary_with_meal
            ? employeeData.daily_salary_with_meal
            : employeeData.daily_salary,
          kredit: 0,
          description: `Gaji harian tanggal ${presences.presence_date}`,
          created_at: new Date(presences.presence_date),
          updated_at: new Date(presences.presence_date)
        };
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
            throw new Error(`Gagal mencatat upah presensi ke jurnal keuangan`);
          }
        }

        if (params.rest_end) {
          const restEnd = new Date(params.rest_end);
          const started = new Date(presences.rest_start);
          const totalRest = Math.floor(Math.abs(restEnd - started) / (1000 * 60)); // minutes
          const restOverdue = Math.floor(totalRest - employeeData.company.setting.rest_limit);
          rest_overdue = restOverdue < 0 ? 0 : restOverdue;

          Object.assign(payloadPresence, {
            rest_overdue: rest_overdue
          });
        }

        const updatePresence = await Presence.update(payloadPresence, {
          where: { id: params.id }
        });

        if (updatePresence < 0) {
          throw new Error(`Failed to update presence with id ${params.id}`);
        }

        if (params.notes) {
          if (params.notes_id) {
            const payloadNotes = {
              notes: params.notes
            };
            const updateNotes = await EmployeeNote.update(payloadNotes, {
              where: [
                { employee_id: params.employee_id },
                Sequelize.where(
                  Sequelize.fn('DATE_FORMAT', Sequelize.col('date'), '%Y-%m-%d'),
                  params.presence_date
                )
              ]
            });

            if (updateNotes < 0) {
              throw new Error(`Failed to update notes for presence with id ${params.id}`);
            }
          } else {
            const payloadNotes = {
              employee_id: params.employee_id,
              date: params.presence_date,
              notes: params.notes
            };

            const createNotes = await EmployeeNote.create(payloadNotes);

            if (createNotes < 0) {
              throw new Error(`Failed to create notes for presence with id ${params.id}`);
            }
          }
        }

        return `Presence with id ${params.id} was updated!`;
      } catch (error) {
        dbError(error);
      }
    },
    deletePresence: async (root, params) => {
      try {
        const { id, presence_date, employee_id } = params;
        let presence = await Presence.findOne({ where: { id } });
        if (!presence) {
          throw new Error('Tidak ditemukan data presensi');
        }

        await Journal.destroy({
          where: [
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
              presence_date
            ),
            { employee_id }
          ]
        });

        presence = await Presence.destroy({
          where: { id },
          cascade: true
        });

        if (!presence) {
          throw new Error('Tidak ada yang terhapus');
        }

        const employeeNote = await EmployeeNote.destroy({
          where: [
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('date'), '%Y-%m-%d'),
              presence_date
            ),
            { employee_id }
          ]
        });
        if (!employeeNote) {
          throw new Error('Tidak ada catatan yang terhapus');
        }
        return 'Berhasil menghapus presensi';
      } catch (error) {
        dbError(error);
      }
    }
  },
  Presence: {
    notes: async root => {
      try {
        const { presence_date } = root;
        const notes = await EmployeeNote.findOne({
          attributes: ['id', 'date', 'notes'],
          where: Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('date'), '%Y-%m-%d'),
            presence_date
          )
        });
        return notes;
      } catch (error) {
        dbError(error);
      }
    },
    bonusPenalty: async root => {
      try {
        const { presence_date, employee_id } = root;
        const journal = await Journal.findAll({
          where: [
            { employee_id },
            Sequelize.where(
              Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d'),
              presence_date
            ),
            { $not: { type: 'withdraw' } },
            { $not: { type: 'salary' } }
          ]
        });
        let totalBonus = 0;
        let totalPenalty = 0;
        for (let i = 0; i < journal.length; i++) {
          totalBonus += journal[i].debet;
          totalPenalty += journal[i].kredit;
        }
        return { bonus: totalBonus, penalty: totalPenalty };
      } catch (error) {
        dbError(error);
      }
    }
  }
};

module.exports = {
  typeDef,
  resolvers
};

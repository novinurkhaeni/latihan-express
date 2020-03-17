module.exports = (sequelize, DataTypes) => {
  const ScheduleNotes = sequelize.define(
    'schedule_notes',
    {
      id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      schedule_id: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      schedule_type: {
        allowNull: false,
        type: DataTypes.STRING
      },
      note: {
        allowNull: false,
        type: DataTypes.STRING
      },
      created_at: {
        allowNull: false,
        type: DataTypes.DATE
      },
      updated_at: {
        allowNull: false,
        type: DataTypes.DATE
      }
    },
    {
      timestamps: true,
      underscored: true
    }
  );

  ScheduleNotes.associate = function(models) {
    // associations can be defined here
    ScheduleNotes.belongsTo(models.defined_schedules, {
      foreignKey: 'schedule_id',
      constraints: false
    });
    ScheduleNotes.belongsTo(models.schedule_templates, {
      foreignKey: 'schedule_id',
      constraints: false
    });
  };

  return ScheduleNotes;
};

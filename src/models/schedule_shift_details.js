'use strict';
module.exports = (sequelize, DataTypes) => {
  const ScheduleShiftDetails = sequelize.define(
    'schedule_shift_details',
    {
      shift_id: {
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'schedule_shifts',
          key: 'id'
        },
        allowNull: false
      },
      schedule_id: { type: DataTypes.INTEGER, allowNull: false },
      schedule_type: { type: DataTypes.STRING, allowNull: false }
    },
    {
      timestamps: true,
      underscored: true
    }
  );
  ScheduleShiftDetails.associate = function(models) {
    // associations can be defined here
    ScheduleShiftDetails.belongsTo(models.schedule_shifts, {
      foreignKey: 'shift_id',
      constraints: false
    });
    ScheduleShiftDetails.belongsTo(models.defined_schedules, {
      foreignKey: 'schedule_id',
      constraints: false
    });
    ScheduleShiftDetails.belongsTo(models.schedule_templates, {
      foreignKey: 'schedule_id',
      constraints: false
    });
  };
  return ScheduleShiftDetails;
};

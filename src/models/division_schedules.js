'use strict';
module.exports = (sequelize, DataTypes) => {
  const DivisionSchedules = sequelize.define(
    'division_schedules',
    {
      division_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'divisions',
          key: 'id'
        }
      },
      schedule_id: { type: DataTypes.INTEGER, allowNull: false },
      schedule_type: { type: DataTypes.STRING, allowNull: false }
    },
    {
      timestamps: true,
      underscored: true
    }
  );
  DivisionSchedules.associate = function(models) {
    // associations can be defined here
    DivisionSchedules.belongsTo(models.divisions, {
      foreignKey: 'division_id'
    });
    DivisionSchedules.belongsTo(models.defined_schedules, {
      foreignKey: 'schedule_id',
      constraints: false
    });
    DivisionSchedules.belongsTo(models.schedule_templates, {
      foreignKey: 'schedule_id',
      constraints: false
    });
  };
  return DivisionSchedules;
};

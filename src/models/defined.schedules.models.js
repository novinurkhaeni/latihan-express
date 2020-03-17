'use strict';
module.exports = (sequelize, DataTypes) => {
  var DefinedSchedule = sequelize.define(
    'defined_schedules',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      employee_id: {
        allowNull: true,
        defaultValue: null,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'employees',
          key: 'id'
        }
      },
      company_id: {
        allowNull: true,
        defaultValue: null,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'companies',
          key: 'id'
        }
      },
      presence_date: {
        type: DataTypes.DATEONLY
      },
      presence_start: {
        type: DataTypes.TIME
      },
      presence_end: {
        type: DataTypes.TIME
      },
      status: {
        type: DataTypes.TINYINT,
        allowNull: true,
        defaultValue: 0
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
      underscored: true,
      timestamps: true
    }
  );
  DefinedSchedule.associate = function(models) {
    // associations can be defined here
    DefinedSchedule.belongsTo(models.employees, {
      foreignKey: 'employee_id'
    });
    DefinedSchedule.belongsTo(models.companies, {
      foreignKey: 'company_id'
    });
    DefinedSchedule.hasOne(models.division_schedules, {
      foreignKey: 'schedule_id',
      scope: { schedule_type: 'defined_schedules' },
      as: 'division'
    });
    DefinedSchedule.hasOne(models.schedule_shift_details, {
      foreignKey: 'schedule_id',
      scope: { schedule_type: 'defined_schedules' },
      as: 'shift'
    });
    DefinedSchedule.hasOne(models.schedule_notes, {
      foreignKey: 'schedule_id',
      scope: { schedule_type: 'defined_schedules' },
      as: 'notes'
    });
    DefinedSchedule.hasMany(models.schedule_swap_details, {
      foreignKey: 'schedule_id',
      onDelete: 'CASCADE'
    });
    DefinedSchedule.hasMany(models.schedule_submissions, {
      foreignKey: 'defined_schedule_id',
      onDelete: 'CASCADE'
    });
  };
  return DefinedSchedule;
};

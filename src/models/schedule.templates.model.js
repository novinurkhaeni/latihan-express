'use strict';
module.exports = (sequelize, DataTypes) => {
  var ScheduleTemplate = sequelize.define(
    'schedule_templates',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      employee_id: {
        allowNull: false,
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
      start_date: {
        type: DataTypes.DATEONLY
      },
      end_date: {
        type: DataTypes.DATEONLY
      },
      start_time: {
        type: DataTypes.TIME
      },
      end_time: {
        type: DataTypes.TIME
      },
      repeat_type: {
        type: DataTypes.STRING
      },
      daily_frequent: {
        type: DataTypes.INTEGER
      },
      weekly_frequent: {
        type: DataTypes.INTEGER
      },
      weekly_frequent_days: {
        type: DataTypes.STRING
      },
      monthly_frequent: {
        type: DataTypes.INTEGER
      },
      monthly_frequent_date: {
        type: DataTypes.STRING
      },
      monthly_frequent_custom_count: {
        type: DataTypes.STRING
      },
      monthly_frequent_custom_days: {
        type: DataTypes.STRING
      },
      yearly_frequent: {
        type: DataTypes.STRING
      },
      yearly_frequent_months: {
        type: DataTypes.STRING
      },
      yearly_frequent_custom_count: {
        type: DataTypes.STRING
      },
      yearly_frequent_custom_days: {
        type: DataTypes.STRING
      },
      deleted_date: {
        type: DataTypes.STRING
      },
      deleted_after: {
        type: DataTypes.DATEONLY
      },
      end_repeat: {
        type: DataTypes.DATEONLY
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
  ScheduleTemplate.associate = function(models) {
    // associations can be defined here
    ScheduleTemplate.belongsTo(models.employees, {
      foreignKey: 'employee_id'
    });
    ScheduleTemplate.belongsTo(models.companies, {
      foreignKey: 'company_id'
    });
    ScheduleTemplate.hasOne(models.division_schedules, {
      foreignKey: 'schedule_id',
      scope: { schedule_type: 'schedule_templates' },
      as: 'division'
    });
    ScheduleTemplate.hasOne(models.schedule_shift_details, {
      foreignKey: 'schedule_id',
      scope: { schedule_type: 'schedule_templates' },
      as: 'shift'
    });
    ScheduleTemplate.hasOne(models.schedule_notes, {
      foreignKey: 'schedule_id',
      scope: { schedule_type: 'schedule_templates' },
      as: 'notes'
    });
  };
  return ScheduleTemplate;
};

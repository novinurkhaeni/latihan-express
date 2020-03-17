'use strict';
module.exports = (sequelize, DataTypes) => {
  const ScheduleSubmissions = sequelize.define(
    'schedule_submissions',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      employee_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'employees',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      defined_schedule_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'defined_schedules',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      type: {
        type: DataTypes.TINYINT,
        allowNull: false
      },
      status: {
        type: DataTypes.TINYINT,
        allowNull: false
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
  ScheduleSubmissions.associate = function(models) {
    // associations can be defined here
    ScheduleSubmissions.belongsTo(models.employees, {
      foreignKey: 'employee_id'
    });
    ScheduleSubmissions.belongsTo(models.defined_schedules, {
      foreignKey: 'defined_schedule_id'
    });
  };
  return ScheduleSubmissions;
};

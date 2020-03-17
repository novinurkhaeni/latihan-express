'use strict';
module.exports = (sequelize, DataTypes) => {
  const ScheduleShift = sequelize.define(
    'schedule_shifts',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      company_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'companies',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      salary_group_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        foreignKey: true,
        references: {
          model: 'salary_groups',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      shift_name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      shift_multiply: {
        type: DataTypes.DECIMAL
      },
      start_time: {
        type: DataTypes.STRING,
        allowNull: false
      },
      end_time: {
        type: DataTypes.STRING,
        allowNull: false
      },
      is_tommorow: {
        type: DataTypes.TINYINT,
        allowNull: true,
        defaultValue: 0
      },
      salary: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      is_deleted: {
        type: DataTypes.TINYINT,
        allowNull: true,
        defaultValue: 0
      },
      color: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
      },
      use_salary_per_shift: {
        type: DataTypes.TINYINT,
        allowNull: true,
        defaultValue: null
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
  ScheduleShift.associate = function(models) {
    // associations can be defined here
    ScheduleShift.belongsTo(models.companies, {
      foreignKey: 'company_id'
    });
    ScheduleShift.belongsTo(models.salary_groups, {
      foreignKey: 'salary_group_id'
    });
    ScheduleShift.hasMany(models.schedule_shift_details, {
      foreignKey: 'shift_id',
      onDelete: 'CASCADE'
    });
  };
  return ScheduleShift;
};

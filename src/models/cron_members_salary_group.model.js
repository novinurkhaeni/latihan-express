'use strict';
module.exports = (sequelize, DataTypes) => {
  const cron_members_salary_group = sequelize.define(
    'cron_members_salary_groups',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      employee_id: {
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'employees',
          key: 'id'
        }
      },
      salary_id: {
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'salary_groups',
          key: 'id'
        }
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
  cron_members_salary_group.associate = function(models) {
    cron_members_salary_group.belongsTo(models.employees, {
      foreignKey: 'employee_id'
    });
    cron_members_salary_group.belongsTo(models.salary_groups, {
      foreignKey: 'salary_id'
    });
  };
  return cron_members_salary_group;
};

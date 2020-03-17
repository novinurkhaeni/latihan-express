'use strict';
module.exports = (sequelize, DataTypes) => {
  const CronSalaryGroups = sequelize.define(
    'cron_salary_groups',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      company_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'companies',
          key: 'id'
        }
      },
      salary_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'salary_groups',
          key: 'id'
        }
      },
      salary_type: { type: DataTypes.INTEGER, allowNull: true },
      salary: { type: DataTypes.INTEGER, allowNull: true },
      transport_allowance: { type: DataTypes.INTEGER, allowNull: true },
      lunch_allowance: { type: DataTypes.INTEGER, allowNull: true },
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
  CronSalaryGroups.associate = function(models) {
    // associations can be defined here
    CronSalaryGroups.belongsTo(models.companies, {
      foreignKey: 'company_id'
    });
    CronSalaryGroups.belongsTo(models.salary_groups, {
      foreignKey: 'salary_id'
    });
  };
  return CronSalaryGroups;
};

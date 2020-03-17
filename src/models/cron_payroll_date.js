'use strict';
module.exports = (sequelize, DataTypes) => {
  const CronPayrollDate = sequelize.define(
    'cron_payroll_dates',
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
        },
        onDelete: 'cascade'
      },
      payroll_date: { type: DataTypes.INTEGER, allowNull: false },
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
  CronPayrollDate.associate = function(models) {
    // associations can be defined here
    CronPayrollDate.belongsTo(models.companies, {
      foreignKey: 'company_id'
    });
  };
  return CronPayrollDate;
};

'use strict';
module.exports = (sequelize, DataTypes) => {
  const CronEmployees = sequelize.define(
    'cron_employees',
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
        },
        onDelete: 'cascade'
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
  CronEmployees.associate = function(models) {
    // associations can be defined here
    CronEmployees.belongsTo(models.employees, {
      foreignKey: 'employee_id'
    });
    CronEmployees.belongsTo(models.companies, {
      foreignKey: 'company_id'
    });
  };
  return CronEmployees;
};

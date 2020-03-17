'use strict';
module.exports = (sequelize, DataTypes) => {
  const SalaryGroup = sequelize.define(
    'salary_groups',
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
      salary_name: {
        type: DataTypes.STRING
      },
      salary_type: {
        type: DataTypes.STRING
      },
      daily_frequent: {
        type: DataTypes.STRING
      },
      salary: {
        type: DataTypes.INTEGER
      },
      transport_allowance: {
        type: DataTypes.INTEGER
      },
      lunch_allowance: {
        type: DataTypes.INTEGER
      },
      use_bpjs: {
        type: DataTypes.TINYINT
      },
      bpjs_allowance: {
        type: DataTypes.INTEGER
      },
      jkk_allowance: {
        type: DataTypes.INTEGER
      },
      jkm_allowance: {
        type: DataTypes.INTEGER
      },
      jht_allowance: {
        type: DataTypes.INTEGER
      },
      jkk_reduction: {
        type: DataTypes.INTEGER
      },
      jkm_reduction: {
        type: DataTypes.INTEGER
      },
      jht_reduction: {
        type: DataTypes.INTEGER
      },
      tax_reduction: {
        type: DataTypes.INTEGER
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
  SalaryGroup.associate = function(models) {
    // associations can be defined here
    SalaryGroup.belongsTo(models.companies, {
      foreignKey: 'company_id'
    });
    SalaryGroup.hasMany(models.allowance, {
      foreignKey: 'salary_groups_id',
      onDelete: 'CASCADE'
    });
    SalaryGroup.hasOne(models.schedule_shifts, {
      foreignKey: 'salary_group_id',
      onDelete: 'CASCADE'
    });
    SalaryGroup.belongsToMany(models.employees, {
      through: 'salary_details',
      foreignKey: 'salary_id',
      otherKey: 'employee_id'
    });
    SalaryGroup.hasOne(models.cron_salary_groups, {
      foreignKey: 'salary_id',
      onDelete: 'CASCADE'
    });
    SalaryGroup.hasMany(models.journals, {
      foreignKey: 'salary_groups_id',
      onDelete: 'SET NULL'
    });
  };
  return SalaryGroup;
};

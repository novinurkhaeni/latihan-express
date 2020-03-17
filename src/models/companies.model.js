'use strict';
module.exports = (sequelize, DataTypes) => {
  var Company = sequelize.define(
    'companies',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      parent_company_id: {
        allowNull: true,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'parent_companies',
          key: 'id'
        }
      },
      codename: {
        allowNull: false,
        type: DataTypes.STRING
      },
      company_name: {
        allowNull: true,
        type: DataTypes.STRING
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      unique_id: {
        allowNull: false,
        type: DataTypes.STRING
      },
      address: {
        allowNull: false,
        type: DataTypes.TEXT
      },
      phone: {
        allowNull: true,
        type: DataTypes.STRING,
        defaultValue: null
      },
      timezone: {
        allowNull: false,
        defaultValue: 'Asia/Jakarta',
        type: DataTypes.STRING
      },
      location: {
        allowNull: false,
        type: DataTypes.STRING
      },
      active: {
        allowNull: false,
        type: DataTypes.TINYINT,
        defaultValue: 0
      },
      registration_complete: {
        allowNull: true,
        type: DataTypes.TINYINT,
        defaultValue: 0
      },
      renew: {
        allowNull: true,
        type: DataTypes.TINYINT,
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
      timestamps: true,
      underscored: true
    }
  );

  Company.associate = function(models) {
    // associations can be defined here
    Company.hasMany(models.employees, {
      foreignKey: 'company_id',
      onDelete: 'CASCADE'
    });
    Company.hasMany(models.presences, {
      foreignKey: 'company_id',
      onDelete: 'CASCADE'
    });
    Company.hasOne(models.company_settings, {
      foreignKey: 'company_id',
      onDelete: 'CASCADE',
      as: 'setting'
    });
    Company.hasOne(models.digital_assets, {
      foreignKey: 'uploadable_id',
      scope: {
        uploadable_type: 'companies',
        type: 'avatar'
      },
      as: 'assets'
    });
    Company.hasMany(models.abilities_category, {
      foreignKey: 'company_id',
      onDelete: 'CASCADE'
    });
    Company.hasMany(models.salary_groups, {
      foreignKey: 'company_id',
      onDelete: 'CASCADE'
    });
    Company.hasMany(models.defined_schedules, {
      foreignKey: 'company_id',
      onDelete: 'CASCADE'
    });
    Company.hasMany(models.schedule_templates, {
      foreignKey: 'company_id',
      onDelete: 'CASCADE'
    });
    Company.hasMany(models.divisions, {
      foreignKey: 'company_id',
      onDelete: 'CASCADE'
    });
    Company.hasMany(models.schedule_shifts, {
      foreignKey: 'company_id',
      onDelete: 'CASCADE'
    });
    Company.belongsToMany(models.subscriptions, {
      through: 'subscription_details',
      foreignKey: 'company_id',
      otherKey: 'subscribe_id'
    });
    Company.hasMany(models.cron_salary_groups, {
      foreignKey: 'company_id',
      onDelete: 'CASCADE'
    });
    Company.hasMany(models.subscription_details, {
      foreignKey: 'company_id',
      onDelete: 'CASCADE',
      as: 'company_info'
    });
    Company.hasOne(models.cron_payroll_dates, {
      foreignKey: 'company_id',
      onDelete: 'CASCADE'
    });
    Company.belongsTo(models.parent_companies, {
      foreignKey: 'parent_company_id',
      onDelete: 'CASCADE'
    });
    Company.hasMany(models.journals, {
      foreignKey: 'company_id',
      onDelete: 'CASCADE'
    });
    Company.hasMany(models.cron_employees, {
      foreignKey: 'company_id',
      onDelete: 'CASCADE'
    });
    Company.hasMany(models.schedule_swaps, {
      foreignKey: 'company_id',
      onDelete: 'CASCADE'
    });
    Company.hasMany(models.subscribements, {
      foreignKey: 'company_id',
      onDelete: 'CASCADE'
    });
  };
  return Company;
};

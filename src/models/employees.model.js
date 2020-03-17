'use strict';
module.exports = (sequelize, DataTypes) => {
  var Employee = sequelize.define(
    'employees',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      company_id: {
        allowNull: false,
        foreignKey: true,
        type: DataTypes.INTEGER,
        references: {
          model: 'companies',
          key: 'id'
        }
      },
      user_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      role: {
        allowNull: false,
        type: DataTypes.INTEGER(11)
      },
      salary: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      meal_allowance: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      daily_salary_with_meal: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      workdays: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      daily_salary: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      flag: {
        allowNull: false,
        type: DataTypes.INTEGER(11)
      },
      active: {
        allowNull: false,
        type: DataTypes.TINYINT,
        defaultValue: 1
      },
      salary_type: {
        allowNull: true,
        type: DataTypes.TINYINT
      },
      gajiandulu_status: {
        allowNull: true,
        type: DataTypes.TINYINT,
        defaultValue: 1
      },
      leave: {
        allowNull: true,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      is_dummy: {
        allowNull: true,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      date_start_work: {
        allowNull: true,
        type: DataTypes.DATEONLY,
        defaultValue: null
      },
      date_end_work: {
        allowNull: true,
        type: DataTypes.DATEONLY,
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
      timestamps: true,
      underscored: true
    }
  );
  Employee.associate = function(models) {
    // associations can be defined here
    Employee.belongsTo(models.users, {
      foreignKey: 'user_id'
    });
    Employee.belongsTo(models.companies, {
      foreignKey: 'company_id'
    });
    Employee.hasMany(models.feedbacks, {
      foreignKey: 'employee_id',
      onDelete: 'CASCADE',
      hooks: true
    });
    Employee.hasMany(models.notifications, {
      foreignKey: 'employee_id',
      onDelete: 'CASCADE',
      hooks: true
    });
    Employee.hasMany(models.presences, {
      foreignKey: 'employee_id',
      onDelete: 'CASCADE',
      hooks: true
    });
    Employee.hasMany(models.journals, {
      foreignKey: 'employee_id',
      onDelete: 'CASCADE',
      hooks: true
    });
    Employee.hasMany(models.employee_notes, {
      foreignKey: 'employee_id',
      onDelete: 'CASCADE',
      hooks: true
    });
    Employee.hasMany(models.schedule_templates, {
      foreignKey: 'employee_id',
      onDelete: 'CASCADE',
      hooks: true
    });
    Employee.hasMany(models.defined_schedules, {
      foreignKey: 'employee_id',
      onDelete: 'CASCADE',
      hooks: true
    });
    Employee.hasMany(models.digital_assets, {
      foreignKey: 'uploadable_id',
      scope: {
        uploadable_type: 'employees'
      },
      as: 'assets',
      onDelete: 'CASCADE',
      hooks: true
    });
    Employee.hasOne(models.abilities, {
      foreignKey: 'employee_id',
      onDelete: 'CASCADE',
      hooks: true
    });
    Employee.hasMany(models.division_details, {
      foreignKey: 'employee_id',
      onDelete: 'CASCADE'
    });
    Employee.belongsToMany(models.salary_groups, {
      through: 'salary_details',
      foreignKey: 'employee_id',
      otherKey: 'salary_id'
    });
    Employee.hasMany(models.periodic_pieces, {
      foreignKey: 'employee_id',
      onDelete: 'cascade'
    });
    Employee.hasOne(models.cron_members_salary_groups, {
      foreignKey: 'employee_id',
      onDelete: 'cascade'
    });
    Employee.hasMany(models.journal_notes, {
      foreignKey: 'employee_id',
      onDelete: 'cascade'
    });
    Employee.hasMany(models.employee_pph21, {
      foreignKey: 'employee_id',
      onDelete: 'CASCADE',
      hooks: true
    });

    Employee.hasOne(models.employee_verifs, {
      foreignKey: 'employee_id',
      onDelete: 'CASCADE',
      hooks: true
    });
    Employee.hasOne(models.cron_employees, {
      foreignKey: 'employee_id',
      onDelete: 'cascade'
    });
    Employee.hasMany(models.home_dumps, {
      foreignKey: 'employee_id',
      onDelete: 'cascade'
    });
    Employee.hasMany(models.submissions, {
      foreignKey: 'employee_id',
      onDelete: 'cascade'
    });
    Employee.hasMany(models.schedule_submissions, {
      foreignKey: 'employee_id',
      onDelete: 'cascade'
    });
    Employee.hasMany(models.transactions, {
      foreignKey: 'employee_id',
      onDelete: 'cascade'
    });
    Employee.hasMany(models.promos, {
      foreignKey: 'employee_id',
      onDelete: 'cascade'
    });
    Employee.hasOne(models.notification_creators, {
      foreignKey: 'employee_id',
      onDelete: 'cascade'
    });
  };
  return Employee;
};

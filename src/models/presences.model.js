'use strict';
module.exports = (sequelize, DataTypes) => {
  const Presences = sequelize.define(
    'presences',
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
        type: DataTypes.INTEGER,
        foreignKey: true,
        defaultValue: null,
        references: {
          model: 'companies',
          key: 'id'
        }
      },
      submission_id: {
        allowNull: true,
        type: DataTypes.INTEGER,
        foreignKey: true,
        defaultValue: null,
        references: {
          model: 'submissions',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      presence_date: {
        allowNull: false,
        type: DataTypes.DATEONLY
      },
      presence_start: {
        allowNull: true,
        type: DataTypes.DATE
      },
      presence_end: {
        allowNull: true,
        type: DataTypes.DATE
      },
      rest_start: {
        allowNull: true,
        type: DataTypes.DATE
      },
      rest_end: {
        allowNull: true,
        type: DataTypes.DATE
      },
      presence_overdue: {
        allowNull: true,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      rest_overdue: {
        allowNull: true,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      is_absence: {
        allowNull: false,
        type: DataTypes.TINYINT,
        defaultValue: 0
      },
      is_leave: {
        allowNull: false,
        type: DataTypes.TINYINT,
        defaultValue: 0
      },
      is_holiday: {
        allowNull: true,
        type: DataTypes.TINYINT,
        defaultValue: 0
      },
      is_permit: {
        allowNull: true,
        type: DataTypes.TINYINT,
        defaultValue: 0
      },
      is_custom_presence: {
        allowNull: true,
        type: DataTypes.TINYINT,
        defaultValue: 0
      },
      overwork: {
        allowNull: true,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      home_early: {
        allowNull: true,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      work_hours: {
        allowNull: true,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      checkin_location: {
        allowNull: true,
        type: DataTypes.STRING
      },
      checkout_location: {
        allowNull: true,
        type: DataTypes.STRING
      },
      rest_begin_location: {
        allowNull: true,
        type: DataTypes.STRING
      },
      rest_over_location: {
        allowNull: true,
        type: DataTypes.STRING
      },
      custom_presence: {
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

  // eslint-disable-next-line no-unused-vars
  Presences.associate = function(models) {
    // Define associations here
    // See http://docs.sequelizejs.com/en/latest/docs/associations/
    Presences.belongsTo(models.employees, {
      foreignKey: 'employee_id'
    });
    Presences.belongsTo(models.companies, {
      foreignKey: 'company_id'
    });
    Presences.hasMany(models.digital_assets, {
      foreignKey: 'uploadable_id',
      scope: {
        uploadable_type: 'presences'
      },
      as: 'assets'
    });
    Presences.belongsTo(models.submissions, {
      foreignKey: 'submission_id'
    });
  };

  return Presences;
};

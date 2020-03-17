'use strict';
module.exports = (sequelize, DataTypes) => {
  var Submission = sequelize.define(
    'submissions',
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
      date: {
        allowNull: true,
        type: DataTypes.STRING
      },
      type: {
        allowNull: false,
        type: DataTypes.TINYINT
      },
      presence_type: {
        allowNull: true,
        type: DataTypes.TINYINT
      },
      start_date: {
        allowNull: true,
        type: DataTypes.STRING
      },
      end_date: {
        allowNull: true,
        type: DataTypes.STRING
      },
      note: {
        allowNull: true,
        type: DataTypes.STRING
      },
      amount: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      status: {
        allowNull: false,
        type: DataTypes.TINYINT
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
  Submission.associate = function(models) {
    // associations can be defined here
    Submission.belongsTo(models.employees, {
      foreignKey: 'employee_id'
    });
    Submission.hasMany(models.digital_assets, {
      foreignKey: 'uploadable_id',
      scope: {
        uploadable_type: 'submissions'
      },
      as: 'assets'
    });
    Submission.hasOne(models.presences, {
      foreignKey: 'submission_id',
      onDelete: 'CASCADE'
    });
  };
  return Submission;
};

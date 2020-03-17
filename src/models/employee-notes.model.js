'use strict';
module.exports = (sequelize, DataTypes) => {
  var EmployeeNote = sequelize.define(
    'employee_notes',
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
      type: {
        type: DataTypes.TINYINT
      },
      date: {
        type: DataTypes.DATEONLY
      },
      notes: {
        type: DataTypes.STRING
      },
      amount: {
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
  EmployeeNote.associate = function(models) {
    // associations can be defined here
    EmployeeNote.belongsTo(models.employees, {
      foreignKey: 'employee_id'
    });
  };
  return EmployeeNote;
};

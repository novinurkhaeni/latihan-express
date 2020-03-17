'use strict';
module.exports = (sequelize, DataTypes) => {
  var EmployeePph21 = sequelize.define(
    'employee_pph21',
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
      ptkp_detail_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'ptkp_details',
          key: 'id'
        }
      },
      position_allowance: {
        allowNull: false,
        type: DataTypes.TINYINT
      },
      npwp: {
        allowNull: false,
        type: DataTypes.STRING
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
  EmployeePph21.associate = function(models) {
    // associations can be defined here
    EmployeePph21.belongsTo(models.employees, {
      foreignKey: 'employee_id'
    });
    EmployeePph21.belongsTo(models.ptkp_details, {
      foreignKey: 'ptkp_detail_id'
    });
  };
  return EmployeePph21;
};

'use strict';
module.exports = (sequelize, DataTypes) => {
  const EmployeeVerif = sequelize.define(
    'employee_verifs',
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
      underscored: true,
      timestamps: true
    }
  );
  EmployeeVerif.associate = function(models) {
    EmployeeVerif.belongsTo(models.employees, {
      foreignKey: 'employee_id'
    });

    EmployeeVerif.hasMany(models.digital_assets, {
      foreignKey: 'uploadable_id',
      scope: {
        uploadable_type: 'employee_verifs'
      },
      as: 'assets',
      onDelete: 'CASCADE',
      hooks: true
    });
  };
  return EmployeeVerif;
};

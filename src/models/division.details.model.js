'use strict';
module.exports = (sequelize, DataTypes) => {
  const DivisionDetail = sequelize.define(
    'division_details',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      employee_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'employees',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      division_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'divisions',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      leadership: {
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
  DivisionDetail.associate = function(models) {
    // associations can be defined here
    DivisionDetail.belongsTo(models.divisions, {
      foreignKey: 'division_id'
    });
    DivisionDetail.belongsTo(models.employees, {
      foreignKey: 'employee_id'
    });
  };
  return DivisionDetail;
};

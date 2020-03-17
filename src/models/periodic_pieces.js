'use strict';
module.exports = (sequelize, DataTypes) => {
  const PeriodicPieces = sequelize.define(
    'periodic_pieces',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      employee_id: {
        type: DataTypes.STRING,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'employees',
          key: 'id'
        }
      },
      type: { type: DataTypes.TINYINT, allowNull: false },
      note: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
      repeat_type: { type: DataTypes.STRING, allowNull: false },
      start: { type: DataTypes.DATEONLY, allowNull: false },
      end: { type: DataTypes.DATEONLY, allowNull: false },
      amount: { type: DataTypes.INTEGER, allowNull: false },
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
  PeriodicPieces.associate = function(models) {
    // associations can be defined here
    PeriodicPieces.belongsTo(models.employees, {
      foreignKey: 'employee_id'
    });
  };
  return PeriodicPieces;
};

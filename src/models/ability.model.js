'use strict';
module.exports = (sequelize, DataTypes) => {
  var Abilities = sequelize.define(
    'abilities',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
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
        allowNull: true,
        type: DataTypes.INTEGER
      },
      ability: {
        allowNull: true,
        type: DataTypes.STRING
      }
    },
    {
      timestamps: true,
      underscored: true
    }
  );
  Abilities.associate = function(models) {
    // associations can be defined here
    Abilities.belongsTo(models.employees, {
      foreignKey: 'employee_id'
    });
  };
  return Abilities;
};

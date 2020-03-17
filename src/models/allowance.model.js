'use strict';
module.exports = (sequelize, DataTypes) => {
  var Allowance = sequelize.define(
    'allowance',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      salary_groups_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'salary_groups',
          key: 'id'
        }
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      type: {
        allowNull: false,
        type: DataTypes.TINYINT,
        defaultValue: 0
      },
      amount: {
        allowNull: false,
        type: DataTypes.INTEGER,
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

  Allowance.associate = function(models) {
    Allowance.belongsTo(models.salary_groups, {
      foreignKey: 'salary_groups_id'
    });
    Allowance.hasMany(models.journals, {
      foreignKey: 'allowance_id',
      onDelete: 'SET NULL'
    });
  };
  return Allowance;
};

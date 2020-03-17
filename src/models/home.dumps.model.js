'use strict';
module.exports = (sequelize, DataTypes) => {
  const homeDump = sequelize.define(
    'home_dumps',
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
      parent_company_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'parent_companies',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      type: { type: DataTypes.TINYINT, allowNull: false },
      identifier: { type: DataTypes.STRING, allowNull: false }
    },
    {
      timestamps: true,
      underscored: true
    }
  );
  homeDump.associate = function(models) {
    // associations can be defined here
    homeDump.belongsTo(models.employees, {
      foreignKey: 'employee_id'
    });
    homeDump.belongsTo(models.parent_companies, {
      foreignKey: 'parent_company_id'
    });
  };
  return homeDump;
};

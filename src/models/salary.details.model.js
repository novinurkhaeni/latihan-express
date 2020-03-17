'use strict';
module.exports = (sequelize, DataTypes) => {
  const SalaryDetail = sequelize.define(
    'salary_details',
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
      salary_id: {
        allowNull: true,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'salary_groups',
          key: 'id'
        }
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
  SalaryDetail.associate = function(models) {
    // associations can be defined here
  };
  return SalaryDetail;
};

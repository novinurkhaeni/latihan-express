'use strict';
module.exports = (sequelize, DataTypes) => {
  const Division = sequelize.define(
    'divisions',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      company_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'companies',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      name: {
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
  Division.associate = function(models) {
    // associations can be defined here
    Division.belongsTo(models.companies, {
      foreignKey: 'company_id'
    });
    Division.hasMany(models.division_details, {
      foreignKey: 'division_id',
      onDelete: 'CASCADE'
    });
    Division.hasMany(models.division_schedules, {
      foreignKey: 'division_id',
      onDelete: 'CASCADE'
    });
  };
  return Division;
};

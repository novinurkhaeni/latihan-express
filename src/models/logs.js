'use strict';
module.exports = (sequelize, DataTypes) => {
  const logs = sequelize.define(
    'logs',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      platform: {
        allowNull: true,
        type: DataTypes.STRING
      },
      company: {
        allowNull: false,
        type: DataTypes.STRING
      },
      description: {
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
      timestamps: true,
      underscored: true
    }
  );
  logs.associate = function(models) {
    // associations can be defined here
  };
  return logs;
};

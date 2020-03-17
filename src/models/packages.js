'use strict';
module.exports = (sequelize, DataTypes) => {
  const Packages = sequelize.define(
    'packages',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      price: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      icon: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
      },
      type: {
        type: DataTypes.TINYINT,
        allowNull: false
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
  Packages.associate = function(models) {
    // associations can be defined here
    Packages.hasMany(models.package_details, {
      foreignKey: 'package_id',
      onDelete: 'CASCADE',
      hooks: true
    });
    Packages.hasMany(models.subscribements, {
      foreignKey: 'package_id',
      onDelete: 'CASCADE',
      hooks: true
    });
  };
  return Packages;
};

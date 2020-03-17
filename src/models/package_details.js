'use strict';
module.exports = (sequelize, DataTypes) => {
  const PackageDetails = sequelize.define(
    'package_details',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      package_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'packages',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      ability: {
        type: DataTypes.STRING,
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
  PackageDetails.associate = function(models) {
    // associations can be defined here
    PackageDetails.belongsTo(models.packages, {
      foreignKey: 'package_id'
    });
  };
  return PackageDetails;
};

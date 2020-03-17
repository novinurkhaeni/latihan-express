'use strict';
module.exports = (sequelize, DataTypes) => {
  var GajianduluData = sequelize.define(
    'gajiandulu_data',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      bank_owner: {
        type: DataTypes.STRING
      },
      bank_name: {
        type: DataTypes.INTEGER
      },
      account_number: {
        type: DataTypes.STRING
      },
      bank_branch: {
        type: DataTypes.STRING
      },
      type: {
        type: DataTypes.INTEGER
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true
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
  GajianduluData.associate = function(models) {
    // associations can be defined here
  };
  return GajianduluData;
};

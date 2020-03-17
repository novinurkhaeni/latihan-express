'use strict';
module.exports = (sequelize, DataTypes) => {
  var DepositHistory = sequelize.define(
    'deposit_histories',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      amount: {
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
  DepositHistory.associate = function(models) {
    // associations can be defined here
  };
  return DepositHistory;
};

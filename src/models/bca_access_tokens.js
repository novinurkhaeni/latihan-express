'use strict';
module.exports = (sequelize, DataTypes) => {
  const bcaAccessTokens = sequelize.define(
    'bca_access_tokens',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      access_token: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      expiry_in: {
        type: DataTypes.INTEGER,
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
      timestamps: true,
      underscored: true
    }
  );
  bcaAccessTokens.associate = function(models) {
    // associations can be defined here
  };
  return bcaAccessTokens;
};

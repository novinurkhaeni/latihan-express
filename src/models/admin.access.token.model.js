'use strict';
module.exports = (sequelize, DataTypes) => {
  var AdminAccessToken = sequelize.define(
    'admin_access_tokens',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      admin_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'admins',
          key: 'id'
        }
      },
      access_token: {
        allowNull: false,
        type: DataTypes.TEXT
      },
      refresh_token: {
        allowNull: false,
        type: DataTypes.STRING
      },
      expiry_in: {
        type: DataTypes.INTEGER
      },
      client_id: {
        type: DataTypes.STRING
      },
      client_secret: {
        type: DataTypes.STRING
      },
      user_agent: {
        type: DataTypes.STRING
      },
      provider: {
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
  AdminAccessToken.associate = function(models) {
    // associations can be defined here
    AdminAccessToken.belongsTo(models.admins, {
      foreignKey: 'admin_id',
      as: 'admin'
    });
  };
  return AdminAccessToken;
};

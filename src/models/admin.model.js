'use strict';
module.exports = (sequelize, DataTypes) => {
  var Admin = sequelize.define(
    'admins',
    {
      full_name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      email: {
        allowNull: false,
        type: DataTypes.STRING,
        unique: true,
        validate: {
          isEmail: true
        }
      },
      password: {
        allowNull: false,
        type: DataTypes.STRING
      },
      roles: {
        allowNull: false,
        type: DataTypes.TINYINT(1)
      },
      active: {
        allowNull: false,
        type: DataTypes.TINYINT(1),
        defaultValue: true
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
  Admin.associate = function(models) {
    // associations can be defined here
    Admin.hasOne(models.admin_access_tokens, {
      foreignKey: 'admin_id',
      onDelete: 'CASCADE'
    });
  };
  return Admin;
};

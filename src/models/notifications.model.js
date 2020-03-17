'use strict';
module.exports = (sequelize, DataTypes) => {
  var Notification = sequelize.define(
    'notifications',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      employee_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'employees',
          key: 'id'
        }
      },
      body: {
        allowNull: false,
        type: DataTypes.TEXT
      },
      is_read: {
        allowNull: false,
        type: DataTypes.TINYINT,
        defaultValue: 0
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
  Notification.associate = function(models) {
    // associations can be defined here
    Notification.belongsTo(models.employees, {
      foreignKey: 'employee_id'
    });
    Notification.hasOne(models.notification_creators, {
      foreignKey: 'notification_id',
      onDelete: 'cascade'
    });
  };
  return Notification;
};

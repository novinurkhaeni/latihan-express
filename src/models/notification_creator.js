'use strict';
module.exports = (sequelize, DataTypes) => {
  const NotificationCreator = sequelize.define(
    'notification_creators',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      employee_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'employees',
          key: 'id'
        }
      },
      notification_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'notifications',
          key: 'id'
        }
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
  NotificationCreator.associate = function(models) {
    // associations can be defined here
    NotificationCreator.belongsTo(models.employees, {
      foreignKey: 'employee_id'
    });
    NotificationCreator.belongsTo(models.notifications, {
      foreignKey: 'employee_id'
    });
  };
  return NotificationCreator;
};

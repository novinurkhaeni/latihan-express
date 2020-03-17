'use strict';
module.exports = (sequelize, DataTypes) => {
  const SubscriptionDetail = sequelize.define(
    'subscription_details',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      company_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'companies',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      subscribe_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'subscriptions',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      date_to_active: {
        type: DataTypes.DATEONLY
      },
      date_to_deactive: {
        type: DataTypes.DATEONLY
      },
      start_period: {
        type: DataTypes.DATEONLY
      },
      end_period: {
        type: DataTypes.DATEONLY
      },
      active: {
        type: DataTypes.STRING,
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
  SubscriptionDetail.associate = function(models) {
    // associations can be defined here
    SubscriptionDetail.belongsTo(models.companies, {
      foreignKey: 'company_id'
    });
  };
  return SubscriptionDetail;
};

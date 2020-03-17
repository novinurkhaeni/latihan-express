'use strict';
module.exports = (sequelize, DataTypes) => {
  const Subscription = sequelize.define(
    'subscriptions',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      subscribe_type: {
        type: DataTypes.STRING
      },
      subscribe_freq: {
        type: DataTypes.INTEGER
      },
      price: {
        type: DataTypes.INTEGER
      },
      description: {
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
      underscored: true,
      timestamps: true
    }
  );
  Subscription.associate = function(models) {
    // associations can be defined here
    Subscription.belongsToMany(models.companies, {
      through: 'subscription_details',
      foreignKey: 'subscribe_id',
      otherKey: 'company_id'
    });
  };
  return Subscription;
};

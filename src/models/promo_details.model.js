'use strict';
module.exports = (sequelize, DataTypes) => {
  const PromoDetails = sequelize.define(
    'promo_details',
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
      promo_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'promos',
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
  PromoDetails.associate = function(models) {
    // associations can be defined here
    PromoDetails.belongsTo(models.employees, {
      foreignKey: 'employee_id'
    });
    PromoDetails.belongsTo(models.promos, {
      foreignKey: 'promo_id'
    });
  };
  return PromoDetails;
};

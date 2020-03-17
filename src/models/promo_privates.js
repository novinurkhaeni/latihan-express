'use strict';
module.exports = (sequelize, DataTypes) => {
  const PromoPrivate = sequelize.define(
    'promo_privates',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      parent_company_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'parent_companies',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      promo_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'promos',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      usage: {
        allowNull: true,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      expired_at: {
        allowNull: false,
        type: DataTypes.DATEONLY
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
  PromoPrivate.associate = function(models) {
    // associations can be defined here
    PromoPrivate.belongsTo(models.parent_companies, {
      foreignKey: 'parent_company_id'
    });
    PromoPrivate.belongsTo(models.promos, {
      foreignKey: 'promo_id'
    });
  };
  return PromoPrivate;
};

'use strict';
module.exports = (sequelize, DataTypes) => {
  const parent_companies = sequelize.define(
    'parent_companies',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      company_name: {
        allowNull: true,
        type: DataTypes.STRING
      },
      active: {
        allowNull: true,
        type: DataTypes.TINYINT,
        defaultValue: 1
      },
      pay_gajiandulu_status: {
        allowNull: true,
        type: DataTypes.TINYINT,
        defaultValue: 1
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
  parent_companies.associate = function(models) {
    // associations can be defined here
    parent_companies.hasMany(models.companies, {
      foreignKey: 'parent_company_id',
      onDelete: 'CASCADE'
    });
    parent_companies.hasMany(models.home_dumps, {
      foreignKey: 'parent_company_id',
      onDelete: 'CASCADE'
    });
    parent_companies.hasMany(models.transactions, {
      foreignKey: 'parent_company_id',
      onDelete: 'CASCADE'
    });
    parent_companies.hasMany(models.promo_privates, {
      foreignKey: 'parent_company_id',
      onDelete: 'CASCADE'
    });
  };
  return parent_companies;
};

'use strict';
module.exports = (sequelize, DataTypes) => {
  const Subscribements = sequelize.define(
    'subscribements',
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
      package_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'packages',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      transaction_id: {
        type: DataTypes.STRING(6),
        allowNull: false,
        foreignKey: true,
        references: {
          model: 'transactions',
          key: 'id'
        },
        onDelete: 'cascade'
      },
      date_to_active: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
      },
      date_to_deactive: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
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
  Subscribements.associate = function(models) {
    // associations can be defined here
    Subscribements.belongsTo(models.companies, {
      foreignKey: 'company_id'
    });
    Subscribements.belongsTo(models.packages, {
      foreignKey: 'package_id'
    });
    Subscribements.belongsTo(models.transactions, {
      foreignKey: 'transaction_id'
    });
  };
  return Subscribements;
};

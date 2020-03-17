'use strict';
module.exports = (sequelize, DataTypes) => {
  const Transactions = sequelize.define(
    'transactions',
    {
      id: {
        primaryKey: true,
        allowNull: true,
        type: DataTypes.STRING(6)
      },
      employee_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'employees',
          key: 'id'
        },
        onDelete: 'cascade'
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
      request_id: {
        type: DataTypes.STRING(30),
        allowNull: true,
        defaultValue: null
      },
      company_code: {
        type: DataTypes.STRING(5),
        allowNull: true,
        defaultValue: null
      },
      channel_type: {
        type: DataTypes.STRING(4),
        allowNull: true,
        defaultValue: null
      },
      paid_amount: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null
      },
      total_amount: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      sub_company: {
        type: DataTypes.STRING(5),
        allowNull: true,
        defaultValue: null
      },
      id_description: {
        type: DataTypes.STRING,
        allowNull: false
      },
      en_description: {
        type: DataTypes.STRING,
        allowNull: false
      },
      payment_status: {
        type: DataTypes.STRING(2),
        allowNull: false
      },
      type: {
        type: DataTypes.TINYINT,
        allowNull: false
      },
      payment_method: {
        type: DataTypes.STRING(10),
        allowNull: false
      },
      url: {
        type: DataTypes.STRING,
        allowNull: true
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
      hooks: {
        beforeCreate: async transactions => {
          const transactionId = ('000000' + Math.floor(Math.random() * Math.pow(10, 6))).substr(-6);
          transactions.id = transactionId;
        }
      },
      underscored: true,
      timestamps: true
    }
  );
  Transactions.associate = function(models) {
    // associations can be defined here
    Transactions.belongsTo(models.employees, {
      foreignKey: 'employee_id'
    });
    Transactions.belongsTo(models.parent_companies, {
      foreignKey: 'parent_company_id'
    });
    Transactions.hasMany(models.subscribements, {
      foreignKey: 'transaction_id',
      onDelete: 'CASCADE',
      hooks: true
    });
  };
  return Transactions;
};

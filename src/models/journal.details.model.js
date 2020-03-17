'use strict';
module.exports = (sequelize, DataTypes) => {
  var JournalDetail = sequelize.define(
    'journal_details',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      journal_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'journals',
          key: 'id'
        }
      },
      tax: {
        type: DataTypes.INTEGER,
        validate: {
          isInt: {
            msg: 'Tax must be an Integer.'
          },
          min: 0
        }
      },
      fee: {
        type: DataTypes.INTEGER,
        validate: {
          isInt: {
            msg: 'Fee must be an Integer.'
          },
          min: 0
        }
      },
      promo_id: {
        type: DataTypes.INTEGER
      },
      promo_applied: {
        type: DataTypes.INTEGER
      },
      total: {
        type: DataTypes.INTEGER
      },
      total_nett: {
        type: DataTypes.INTEGER
      },
      last_salary: {
        type: DataTypes.INTEGER
      },
      status: {
        allowNull: false,
        type: DataTypes.TINYINT(2),
        defaultValue: 0
      },
      bank_name: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
      },
      account_number: {
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
      timestamps: true,
      underscored: true
    }
  );
  JournalDetail.associate = function(models) {
    // associations can be defined here
    JournalDetail.belongsTo(models.journals, {
      foreignKey: 'journal_id'
    });
    JournalDetail.hasMany(models.digital_assets, {
      foreignKey: 'uploadable_id',
      scope: {
        uploadable_type: 'withdraw'
      },
      as: 'assets'
    });
  };
  return JournalDetail;
};

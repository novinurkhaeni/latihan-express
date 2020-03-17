module.exports = (sequelize, DataTypes) => {
  const Promo = sequelize.define(
    'promos',
    {
      id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      code: {
        allowNull: false,
        unique: true,
        type: DataTypes.STRING,
        validate: {
          notEmpty: { msg: 'Please input code' }
        }
      },
      type: {
        allowNull: false,
        type: DataTypes.STRING
      },
      amount: {
        allowNull: false,
        type: DataTypes.INTEGER,
        validate: {
          notEmpty: { msg: 'Please input discount' },
          isNumeric: { msg: 'Please input only format number' }
        }
      },
      effective_date: {
        allowNull: false,
        type: DataTypes.DATEONLY
      },
      expired_date: {
        allowNull: false,
        type: DataTypes.DATEONLY,
        validate: {
          notEmpty: { msg: 'Please input expired date' }
        }
      },
      limit: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      usage: {
        allowNull: true,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      type_of_use: {
        allowNull: true,
        type: DataTypes.STRING('15'),
        defaultValue: 'general',
        after: 'usage'
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
  Promo.associate = function(models) {
    // associations can be defined here
    Promo.hasOne(models.promo_details, {
      foreignKey: 'promo_id',
      onDelete: 'cascade'
    });
    Promo.hasOne(models.promo_privates, {
      foreignKey: 'promo_id',
      onDelete: 'cascade'
    });
  };
  return Promo;
};

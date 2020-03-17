module.exports = function(sequelize, DataTypes) {
  const BankData = sequelize.define(
    'bank_data',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      user_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      full_name: {
        allowNull: false,
        type: DataTypes.STRING,
        validate: {
          min: {
            args: 4,
            msg: 'full name must start with a letter, have no spaces, and be at least 3 characters.'
          },
          max: {
            args: 40,
            msg:
              'full name must start with a letter, have no spaces, and be at less than 40 characters.'
          },
          is: {
            args: /^[A-Za-z][A-Za-z0-9-]*\s?[A-Za-z][A-Za-z0-9-]*\s?[A-Za-z][A-Za-z0-9-]+$/gi, // must start with letter and only have letters, numbers, dashes
            msg: 'full name must start with a letter and be 3 - 40 characters.'
          },
          notEmpty: { msg: 'Please input full name' }
        }
      },
      bank_name: {
        allowNull: false,
        type: DataTypes.STRING,
        validate: {
          notEmpty: { msg: 'Please input bank name' }
        }
      },
      bank_branch: {
        allowNull: true,
        type: DataTypes.STRING,
        validate: {
          notEmpty: { msg: 'Please input bank branch' }
        }
      },
      account_number: {
        allowNull: false,
        type: DataTypes.STRING,
        unique: true,
        validate: {
          notEmpty: { msg: 'Please input account number' }
        }
      },
      active: {
        allowNull: false,
        type: DataTypes.INTEGER,
        unique: true,
        validate: {
          notEmpty: { msg: 'Please input status' }
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

  // eslint-disable-next-line no-unused-vars
  BankData.associate = function(models) {
    // Define associations here
    // See http://docs.sequelizejs.com/en/latest/docs/associations/
    BankData.belongsTo(models.users, {
      foreignKey: 'user_id'
    });
  };

  return BankData;
};

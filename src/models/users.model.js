module.exports = function(sequelize, DataTypes) {
  const User = sequelize.define(
    'users',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      full_name: {
        allowNull: true,
        type: DataTypes.STRING,
        validate: {
          max: {
            args: 40,
            msg:
              'Username must start with a letter, have no spaces, and be at less than 40 characters.'
          },
          notEmpty: { msg: 'Please input username' }
        }
      },
      email: {
        allowNull: true,
        type: DataTypes.STRING,
        unique: true
      },
      password: {
        allowNull: true,
        type: DataTypes.STRING
      },
      birthday: {
        allowNull: true,
        type: DataTypes.DATEONLY,
        validate: {
          isDate: true
        }
      },
      phone: {
        allowNull: true,
        unique: true,
        type: DataTypes.STRING
      },
      hash: {
        allowNull: true,
        type: DataTypes.STRING,
        defaultValue: null
      },
      is_active_notif: {
        type: DataTypes.TINYINT,
        defaultValue: 1
      },
      is_phone_confirmed: {
        type: DataTypes.TINYINT,
        defaultValue: 0
      },
      is_email_confirmed: {
        type: DataTypes.TINYINT,
        defaultValue: 1
      },
      is_has_dummy: {
        type: DataTypes.TINYINT,
        defaultValue: 1
      },
      currency: {
        allowNull: false,
        type: DataTypes.STRING,
        defaultValue: 'IDR'
      },
      registration_complete: {
        type: DataTypes.TINYINT,
        defaultValue: 0
      },
      login_attempt: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      demo_mode: {
        type: DataTypes.TINYINT,
        allowNull: true,
        defaultValue: 1
      },
      demo_step: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null
      },
      demo_account: {
        type: DataTypes.TINYINT,
        allowNull: true,
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
      timestamps: true,
      underscored: true
    }
  );

  // eslint-disable-next-line no-unused-vars
  User.associate = function(models) {
    // Define associations here
    // See http://docs.sequelizejs.com/en/latest/docs/associations
    User.hasOne(models.access_tokens, {
      foreignKey: 'user_id',
      onDelete: 'CASCADE'
    });
    User.hasMany(models.bank_data, {
      foreignKey: 'user_id',
      onDelete: 'CASCADE'
    });
    User.hasMany(models.employees, {
      foreignKey: 'user_id',
      onDelete: 'CASCADE'
    });
    User.hasMany(models.digital_assets, {
      foreignKey: 'uploadable_id',
      scope: {
        uploadable_type: 'users'
      },
      as: 'assets'
    });
    User.hasMany(models.feedback_conversations, {
      foreignKey: 'commentable_id',
      scope: {
        commentable_type: 'users'
      }
    });
    User.hasOne(models.pins, {
      foreignKey: 'user_id',
      onDelete: 'CASCADE'
    });
  };

  User.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());

    delete values.password;
    return values;
  };

  return User;
};

module.exports = function(sequelize, DataTypes) {
  const DigitalAsset = sequelize.define(
    'digital_assets',
    {
      id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      path: {
        allowNull: true,
        type: DataTypes.STRING
      },
      filename: {
        allowNull: true,
        type: DataTypes.STRING
      },
      url: {
        allowNull: false,
        type: DataTypes.STRING
      },
      mime_type: {
        allowNUll: false,
        type: DataTypes.STRING
      },
      is_verified: {
        allowNull: true,
        type: DataTypes.TINYINT
      },
      type: {
        allowNull: false,
        type: DataTypes.STRING
      },
      uploadable_type: {
        allowNull: false,
        type: DataTypes.STRING
      },
      uploadable_id: {
        allowNUll: false,
        type: DataTypes.INTEGER
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
  DigitalAsset.associate = function(models) {
    // Define associations here
    // See http://docs.sequelizejs.com/en/latest/docs/associations/
    DigitalAsset.belongsTo(models.users, {
      foreignKey: 'uploadable_id',
      constraints: false
    });
    DigitalAsset.belongsTo(models.employees, {
      foreignKey: 'uploadable_id',
      constraints: false
    });
    DigitalAsset.belongsTo(models.companies, {
      foreignKey: 'uploadable_id',
      constraints: false
    });
    DigitalAsset.belongsTo(models.presences, {
      foreignKey: 'uploadable_id',
      constraints: false
    });
    DigitalAsset.belongsTo(models.journal_details, {
      foreignKey: 'uploadable_id',
      constraints: false
    });
    DigitalAsset.belongsTo(models.employee_verifs, {
      foreignKey: 'uploadable_id',
      constraints: false
    });
    DigitalAsset.belongsTo(models.submissions, {
      foreignKey: 'uploadable_id',
      constraints: false
    });
  };

  return DigitalAsset;
};

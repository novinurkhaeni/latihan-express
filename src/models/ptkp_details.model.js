'use strict';
module.exports = (sequelize, DataTypes) => {
  var PtkpDetails = sequelize.define(
    'ptkp_details',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      ptkp_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'ptkp',
          key: 'id'
        }
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING
      },
      amount: {
        allowNull: false,
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

  PtkpDetails.associate = function(models) {
    PtkpDetails.belongsTo(models.ptkp, {
      foreignKey: 'ptkp_id'
    });
    PtkpDetails.hasMany(models.employee_pph21, {
      foreignKey: 'ptkp_detail_id',
      onDelete: 'CASCADE',
      hooks: true
    });
  };

  return PtkpDetails;
};

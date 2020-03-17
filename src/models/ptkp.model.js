'use strict';
module.exports = (sequelize, DataTypes) => {
  const Ptkp = sequelize.define(
    'ptkp',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING
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
      underscored: true,
      tableName: 'ptkp'
    }
  );

  Ptkp.associate = function(models) {
    Ptkp.hasMany(models.ptkp_details, {
      foreignKey: 'ptkp_id',
      onDelete: 'CASCADE'
    });
  };

  return Ptkp;
};

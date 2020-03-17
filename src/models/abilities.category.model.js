'use strict';
module.exports = (sequelize, DataTypes) => {
  var AbilitiesCategory = sequelize.define(
    'abilities_category',
    {
      id: {
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.INTEGER
      },
      company_id: {
        allowNull: true,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'companies',
          key: 'id'
        }
      },
      name: {
        allowNull: true,
        type: DataTypes.STRING
      },
      role: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      ability: {
        allowNull: true,
        type: DataTypes.STRING
      }
    },
    {
      timestamps: true,
      underscored: true
    }
  );
  AbilitiesCategory.associate = function(models) {
    // associations can be defined here
    AbilitiesCategory.belongsTo(models.companies, {
      foreignKey: 'company_id'
    });
  };
  return AbilitiesCategory;
};

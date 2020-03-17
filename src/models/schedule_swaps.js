'use strict';
module.exports = (sequelize, DataTypes) => {
  const ScheduleSwaps = sequelize.define(
    'schedule_swaps',
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
      description: { type: DataTypes.STRING },
      note: {
        allowNull: false,
        type: DataTypes.STRING,
        defaultValue: null
      },
      status: { type: DataTypes.TINYINT },
      self_id: { type: DataTypes.INTEGER },
      away_id: { type: DataTypes.INTEGER },
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
  ScheduleSwaps.associate = function(models) {
    // associations can be defined here
    ScheduleSwaps.belongsTo(models.companies, {
      foreignKey: 'company_id'
    });
    ScheduleSwaps.hasMany(models.schedule_swap_details, {
      foreignKey: 'schedule_swap_id',
      onDelete: 'CASCADE'
    });
  };
  return ScheduleSwaps;
};

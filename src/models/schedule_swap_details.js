'use strict';
module.exports = (sequelize, DataTypes) => {
  const ScheduleSwapDetails = sequelize.define(
    'schedule_swap_details',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      schedule_swap_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: { model: 'schedule_swap', key: 'id' },
        onDelete: 'cascade'
      },
      schedule_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        foreignKey: true,
        references: { model: 'defined_schedules', key: 'id' },
        onDelete: 'cascade'
      },
      type: { type: DataTypes.TINYINT },
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
  ScheduleSwapDetails.associate = function(models) {
    // associations can be defined here
    ScheduleSwapDetails.belongsTo(models.schedule_swaps, {
      foreignKey: 'schedule_swap_id',
      onDelete: 'CASCADE'
    });
    ScheduleSwapDetails.belongsTo(models.defined_schedules, {
      foreignKey: 'schedule_id',
      onDelete: 'CASCADE'
    });
  };
  return ScheduleSwapDetails;
};

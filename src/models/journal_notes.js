'use strict';
module.exports = (sequelize, DataTypes) => {
  const journal_notes = sequelize.define(
    'journal_notes',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      employee_id: {
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'employees',
          key: 'id'
        }
      },
      type: {
        type: DataTypes.STRING
      },
      note: {
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
      underscored: true
    }
  );
  journal_notes.associate = function(models) {
    // associations can be defined here
    journal_notes.belongsTo(models.employees, {
      foreignKey: 'employee_id'
    });
  };
  return journal_notes;
};

module.exports = (sequelize, DataTypes) => {
  const Feedback = sequelize.define(
    'feedbacks',
    {
      id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      employee_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'employees',
          key: 'id'
        }
      },
      summary: {
        allowNull: false,
        type: DataTypes.STRING
      },
      status: {
        allowNull: false,
        type: DataTypes.ENUM('pending', 'onprocess', 'resolved'),
        defaultValue: 'pending'
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
  Feedback.associate = function(models) {
    // associations can be defined here
    Feedback.belongsTo(models.employees, { foreignKey: 'employee_id' });
    Feedback.hasMany(models.feedback_conversations, {
      foreignKey: 'feedback_id',
      as: 'conversations',
      hooks: true
    });
  };
  return Feedback;
};

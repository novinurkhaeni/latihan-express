module.exports = (sequelize, DataTypes) => {
  const FeedbackConversation = sequelize.define(
    'feedback_conversations',
    {
      id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      feedback_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        foreignKey: true,
        references: {
          model: 'feedbacks',
          key: 'id'
        }
      },
      commentable_id: {
        allowNull: false,
        type: DataTypes.INTEGER
      },
      commentable_type: {
        allowNull: false,
        type: DataTypes.STRING,
        defaultValue: 'user'
      },
      body: {
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
      underscored: true
    }
  );

  FeedbackConversation.associate = function(models) {
    // associations can be defined here
    FeedbackConversation.belongsTo(models.feedbacks, {
      foreignKey: 'feedback_id'
    });
    FeedbackConversation.belongsTo(models.users, {
      foreignKey: 'commentable_id',
      constraints: false
    });
  };

  return FeedbackConversation;
};

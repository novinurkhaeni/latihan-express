const { merge } = require('lodash');

const {
  admin,
  user,
  company,
  employee,
  promo,
  feedback,
  journal,
  journalDetail,
  presence,
  gajianDuluData,
  upload,
  bankData,
  companySettings,
  feedbackConversations,
  withdrawHistory,
  accessLevel,
  categoryAccessLevel,
  schedule,
  subscription,
  logs,
  ptkp,
  ptkpDetail,
  userConfirmation,
  userMonitor,
  exportExcel
} = require('./defs');

const query = `
  type Query {
    _empty: String
  }
  type Mutation {
    _empty: String
  }
`;
const typeDefs = [
  query,
  admin.typeDef,
  user.typeDef,
  company.typeDef,
  employee.typeDef,
  feedback.typeDef,
  promo.typeDef,
  journalDetail.typeDef,
  journal.typeDef,
  presence.typeDef,
  gajianDuluData.typeDef,
  upload.typeDef,
  bankData.typeDef,
  companySettings.typeDef,
  feedbackConversations.typeDef,
  withdrawHistory.typeDef,
  accessLevel.typeDef,
  categoryAccessLevel.typeDef,
  schedule.typeDef,
  subscription.typeDef,
  logs.typeDef,
  ptkp.typeDef,
  ptkpDetail.typeDef,
  userConfirmation.typeDef,
  userMonitor.typeDef,
  exportExcel.typeDef
];
const resolvers = merge(
  admin.resolvers,
  user.resolvers,
  company.resolvers,
  employee.resolvers,
  feedback.resolvers,
  promo.resolvers,
  journalDetail.resolvers,
  journal.resolvers,
  presence.resolvers,
  gajianDuluData.resolvers,
  upload.resolvers,
  bankData.resolvers,
  companySettings.resolvers,
  feedbackConversations.resolvers,
  withdrawHistory.resolvers,
  accessLevel.resolvers,
  categoryAccessLevel.resolvers,
  schedule.resolvers,
  subscription.resolvers,
  logs.resolvers,
  ptkp.resolvers,
  ptkpDetail.resolvers,
  userConfirmation.resolvers,
  userMonitor.resolvers,
  exportExcel.resolvers
);
const schema = {
  typeDefs,
  resolvers
};

module.exports = schema;

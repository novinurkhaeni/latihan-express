const { gql } = require('apollo-server-express');

const {
  subscriptions: Subscription,
  subscription_details: SubscriptionDetail,
  companies: Company,
  journals: Journal,
  employees: Employee
} = require('@models');

const {
  errorHandler: { dbError }
} = require('@helpers');

/**
 * Schedule Graphql Defs
 */

// TypeDef of Subscription

const typeDef = gql`
  extend type Query {
    subscriptions: [Subscription]!
    subscription(id: ID!): Subscription!
    subscriptionDetails: [SubscriptionDetail]
  }

  extend type Mutation {
    createSubscription(
      subscribe_type: String!
      subscribe_freq: Int!
      price: Float!
      description: String!
    ): Subscription!

    updateSubscription(
      id: ID!
      subscribe_type: String!
      subscribe_freq: Int!
      price: Float!
      description: String!
    ): Subscription!

    deleteSubscription(id: ID!): String!

    updateInstantCompanySubscription(company_id: Int!, subscribe_id: Int!): SubscriptionDetail!
    updateDelayCompanySubscription(company_id: Int!, subscribe_id: Int!): SubscriptionDetail!
  }

  type Subscription {
    id: ID!
    subscribe_type: String
    subscribe_freq: Int
    price: Float
    description: String
    created_at: String
    updated_at: String
    subscription_details: [SubscriptionDetail]
  }

  type SubscriptionDetail {
    id: Int
    company_id: Int
    subscribe_id: Int
    date_to_active: String
    date_to_deactive: String
    active: String
    subscription: Subscription
    start_period: String
    end_period: String
    company: Company
  }
`;

// Subscription Resolvers
const resolvers = {
  Query: {
    subscription: async (root, { id }) => {
      try {
        const result = await Subscription.findById(id);
        if (!result) {
          throw new Error('Id not found');
        }
        return result;
      } catch (error) {
        dbError(error);
      }
    },
    subscriptions: async (root, params) => {
      const { limit, offset } = params;
      try {
        return await Subscription.all({ offset, limit });
      } catch (error) {
        dbError(error);
      }
    },
    subscriptionDetails: async (root, params) => {
      const { limit, offset } = params;
      try {
        const subscriptionDetails = await SubscriptionDetail.all({
          offset,
          limit,
          where: { active: 1 },
          include: {
            model: Company,
            include: {
              model: Subscription
              // where: { id: { $in: Sequelize.literal('(SELECT DISTINCT subscribe_id FROM subscription_details WHERE active = "1")') }}
            }
          }
        });
        return subscriptionDetails;
      } catch (error) {
        dbError(error);
      }
    }
  },
  Mutation: {
    createSubscription: async (root, params) => {
      try {
        const subscription = Subscription.create(params);
        if (subscription) {
          return subscription;
        }
      } catch (error) {
        dbError(error);
      }
    },
    updateSubscription: async (root, params) => {
      const { id } = params;
      try {
        const updateSubscription = await Subscription.update(params, { where: { id } });
        if (updateSubscription > 0) {
          const result = await Subscription.findOne({ where: { id } });
          return result;
        }
        throw new Error(`Error update Subscription with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    },
    deleteSubscription: async (root, { id }) => {
      try {
        const deletedSubscription = await Subscription.destroy({ where: { id } });
        if (deletedSubscription !== 0) {
          return `Subscription with id ${id} was deleted!`;
        }
        throw new Error(`Error deleting subscription with id ${id}`);
      } catch (error) {
        dbError(error);
      }
    },
    updateDelayCompanySubscription: async (root, params) => {
      try {
        const { subscribe_id: subscribeId, company_id: companyId } = params;

        let subscribe = await SubscriptionDetail.findOne({
          where: { company_id: companyId, active: 1 }
        });

        const subscribeData = await Subscription.findOne({ where: { id: subscribeId } });

        if (!subscribe) {
          throw new Error('Perusahaan belum berlangganan paket');
        }
        // update subscription
        const subscribeDate = new Date(subscribe.updated_at);
        const nextMonth = subscribeDate.setMonth(subscribeDate.getMonth() + 1);

        subscribe = await SubscriptionDetail.findOne({
          where: {
            company_id: companyId,
            date_to_active: {
              $gte: new Date()
            }
          }
        });

        if (subscribe) {
          throw new Error(
            'Anda sudah membuat perubahan berlangganan untuk bulan depan, silakan tunggu bulan depan!'
          );
        }

        if (parseInt(subscribeData.subscribe_freq)) {
          let endPeriod = new Date(nextMonth).setMonth(
            new Date(nextMonth).getMonth() + parseInt(subscribeData.subscribe_freq)
          );
          endPeriod = new Date(endPeriod).setDate(new Date(endPeriod).getDate() - 1);
          subscribe = await SubscriptionDetail.create({
            company_id: companyId,
            subscribe_id: subscribeId,
            date_to_active: nextMonth,
            start_period: nextMonth,
            end_period: new Date(endPeriod)
          });
        }

        subscribe = await SubscriptionDetail.update(
          { date_to_deactive: nextMonth, end_period: nextMonth },
          { where: { company_id: companyId, active: 1 } }
        );

        return subscribe;
      } catch (error) {
        dbError(error);
      }
    },
    updateInstantCompanySubscription: async (root, params) => {
      try {
        const { subscribe_id: subscribeId, company_id: companyId } = params;
        const employee = await Employee.findOne({ where: { company_id: companyId, role: 1 } });

        let subscribe = await SubscriptionDetail.findOne({
          where: { company_id: companyId, active: 1 }
        });

        const subscribeData = await Subscription.findOne({ where: { id: subscribeId } });
        if (!subscribe) {
          throw new Error('Perusahaan belum berlangganan');
        }

        const journal = await Journal.create({
          employee_id: employee.id,
          type: 'subscribe',
          debet: 0,
          kredit: subscribeData.price,
          description: `Tagihan berlangganan fitur ${subscribeData.subscribe_type}, durasi ${subscribeData.subscribe_freq} bulan. -- ${subscribeData.description}`
        });
        if (!journal) {
          throw new Error('Gagal membuat tagihan berlangganan');
        }

        subscribe = await SubscriptionDetail.update(
          { active: 0 },
          { where: { company_id: companyId, active: 1 } }
        );

        const startPeriod = new Date();
        let endPeriod = new Date().setMonth(
          new Date().getMonth() + parseInt(subscribeData.subscribe_freq)
        );
        endPeriod = new Date(endPeriod).setDate(new Date().getDate() - 1);
        subscribe = await SubscriptionDetail.create({
          company_id: companyId,
          subscribe_id: subscribeId,
          start_period: startPeriod,
          end_period: new Date(endPeriod),
          active: 1
        });
        return subscribe;
      } catch (error) {
        dbError(error);
      }
    }
  },
  Subscription: {
    subscription_details: async (root, params) => {
      try {
        const result = await SubscriptionDetail.findAll({
          where: { subscribe_id: root.id }
        });

        return result;
      } catch (error) {
        dbError(error);
      }
    }
  }
};

module.exports = {
  typeDef,
  resolvers
};

/* eslint-disable*/
const { gql } = require('apollo-server-express');
const { digital_assets: DigitalAsset } = require('@models');
const {
  errorHandler: { dbError }
} = require('@helpers');

// TODO: MAKE UPLOAD WORKS!

const typeDef = gql`
  extend type Query {
    uploads: [File]
  }

  extend type Mutation {
    singleUpload(file: Upload!): File!
  }

  type File {
    filename: String!
    mimetype: String!
    encoding: String!
  }
`;

const resolvers = {
  Query: {
    uploads: async () => {
      // Nothing
    }
  },
  Mutation: {
    async singleUpload(parent, { file }) {
      console.log('FILENYA', await file);
      console.log('PARENT', parent);
      const { stream, filename, mimetype, encoding } = await file;
    }
  }
};

module.exports = {
  typeDef,
  resolvers
};

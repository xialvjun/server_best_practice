const path = require('path')
const lodash = require('lodash');
const uuid = require('uuid');
const { makeExecutableSchema } = require('graphql-tools');

const config = require('../config');
const knex = config.knex;

const schema_gql = require('fs').readFileSync(path.join(__dirname, '../schema.gql'), 'utf8');

const resolvers = {
  Query: {
    a(root, args, ctx, ast) {
      return 'aaaa'
    }
  },
  // Mutation: {
  // },
};

const typeDefs = [schema_gql];

module.exports = makeExecutableSchema({
  typeDefs,
  resolvers,
});

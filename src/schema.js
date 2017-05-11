const lodash = require('lodash');
const uuid = require('uuid');
const { makeExecutableSchema } = require('graphql-tools');

const knex = require('./knex.js');

const schema_gql = require('fs').readFileSync(path.join(__dirname, '../schema.gql'), 'utf8');

const resolvers = {
  Mutation: {
  },
};

const typeDefs = [schema_gql];

module.exports = makeExecutableSchema({
  typeDefs,
  resolvers,
});

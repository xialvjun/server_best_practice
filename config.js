const knexfile = require('./knexfile');
const knex = require('knex');
const jwt = require('jsonwebtoken');


const jwt_secret = process.env.jwt_secret;

function sign(payload, options) {
  return jwt.sign(payload, jwt_secret, options);
}

function verify(token, options) {
  try {
    return jwt.verify(token, jwt_secret, options);
  } catch (error) {
    return null;
  }
}

module.exports = {
  knex_config: knexfile,
  knex: knex(knexfile),

  jwt_secret: jwt_secret,
  jwt: { sign, verify },
}

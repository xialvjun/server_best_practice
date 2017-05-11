const passport =require('koa-passport');
const Strategy = require('passport-strategy').Strategy;

const LocalStrategy = require('passport-local').Strategy;

const config = require('../config');

passport.use('local', new LocalStrategy(
  { passReqToCallback: true },
  async function(req, username, password, done) {
    try {
      let user = await config.knex('users').where({ username, password });
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }
));

class PureStrategy extends Strategy {
  constructor(verify) {
    super();
    this.name = 'pure';
    if (!verify) { throw new TypeError('PureStrategy requires a verify callback'); }
    this.verify = verify;
  }
  authenticate(req, options) {
    const self = this;
    function done(err, user, info) {
      if (err) { return self.error(err); }
      if (!user) { return self.fail(info); }
      self.success(user, info);
    }
    
    try {
      this.verify(req, done);
    } catch (ex) {
      return this.error(ex);
    }
  }
}

passport.use('pure', new PureStrategy(
  async function(req, done) {
    try {
      let user = await config.knex('users').where(req.body).first();
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }
));


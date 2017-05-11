const config = require('../config');

const passport = require('koa-passport');
const LocalStrategy = require('passport-local').Strategy;
const WechatStrategy = require('passport-wechat').Strategy;

const Strategy = require('passport-strategy').Strategy;
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



// // username password 用 form 表单传过来
// passport.use('form', new LocalStrategy(
//   { passReqToCallback: true },
//   async function (req, username, password, done) {
//     try {
//       let user = await config.knex('users').where({ username, password });
//       return done(null, user);
//     } catch (error) {
//       return done(error, null);
//     }
//   }
// ));

// // username password 以 json 的形式放在 body 中
// passport.use('json', new PureStrategy(
//   async function (req, done) {
//     try {
//       let user = await config.knex('users').where(req.body).first();
//       return done(null, user);
//     } catch (error) {
//       return done(error, null);
//     }
//   }
// ));
// // 因为使用了 koa-body ，所以不需要区分 form 和 json
passport.use('local', new LocalStrategy(
  { passReqToCallback: true },
  async function (req, username, password, done) {
    try {
      let user = await config.knex('users').where({ username, password }).first();
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }
));

// 使用旧的 token 获取新的 token，从而刷新 token，延长时间
passport.use('token', new PureStrategy(
  async function (req, done) {
    try {
      let jwt = config.jwt.verify(req.body.token);
      if (jwt) {
        let { sid, user_id } = jwt;
        // 检测该 session 是否已被其他客户端删除
        let sess = await config.knex('sessions').where({ sid }).andWhere('expire_at', '>', Date.now()).first();
        if (sess) {
          let user = await config.knex('users').where({ _id: sess.user_id }).first();
          return done(null, user);
        }
        return done(null, null);
      }
      return done(null, null);
    } catch (error) {
      return done(error, null);
    }
  }
));

passport.use('wechat', new WechatStrategy(
  {
    // appID: {APPID},
    // name:{默认为wechat,可以设置组件的名字}
    // appSecret: {APPSECRET},
    // client:{wechat|web},
    // callbackURL: {CALLBACKURL},
    // scope: {snsapi_userinfo|snsapi_base},
    // state:{STATE},
    // getToken: {getToken},
    // saveToken: {saveToken},
    appID: 'asfasfsasag',
    appSecret: 'asagasgsag',
    client: 'web',
    // 其他都可省略
  },
  async function (accessToken, refreshToken, profile, expires_in, done) {
    let { openid, unionid } = profile;
    let user = await upsert(openid);
    return done(err, user);
  }
));

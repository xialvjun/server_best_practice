require('dotenv').config();

const config = require('../config');

const uuid = require('uuid');

const Koa = require('koa');
const route = require('koa-route');

const app = new Koa();

app.use(require('koa-body')());

const passport = require('koa-passport');
require('./passport');
app.use(passport.initialize());

app.use(async function parse_jwt(ctx, next) {
  let token = (ctx.request.headers['authorization'] || '').replace('Bearer ', '');
  ctx.state.jwt = config.jwt.verify(token);
  await next();
});

const { default: session } = require('koa-lazy-multi-session');
const { default: Store } = require('knex-schema-session-store');
const store = new Store(config.knex, {
  schemas: [
    { name: 'sess_name', type: 'string', extra: cb=>cb.notNullable(), },
    { name: 'user_id', type: 'string', extra: cb=>cb.notNullable(), },
  ]
});

app.use(session({
  get_sid: ctx => ctx.state.jwt && ctx.state.jwt.sid,
  store,
}));

app.use(route.post('/tokens', async function login(ctx, next) {
  let FALSE_NULL_OR_NEXT = await passport.authenticate(['local', 'token'], async (err, user, info, status) => {
    if (user) {
      let sid = uuid();
      await ctx.session({ sid, sess_name: ctx.request.body.sess_name || sid, user_id: user._id, user });
      let token = config.jwt.sign({sid, user_id: user._id}, { expiresIn: '7d', noTimestamp: true });
      ctx.body = { token, user };
    } else {
      ctx.body = info;
    }
  })(ctx, next);
}));

app.use(route.get('/tokens', async function tokens(ctx, next) {
  let session = await ctx.session();
  ctx.assert(session, 401);
  ctx.body = await store.repo().where({ user_id: session.user_id }).select();
}));

app.use(route.get('/oauth', async function oauth(ctx, next) {
  // 这里覆盖 callbackURL 是因为如何把 token 传给客户端。这个 callbackURL 是微信服务器命令浏览器跳转过来的，然后服务器接收到该路径，汲取 code，获取 user，然后以 json 的形式发送 token。。。但是，页面呢？整个页面只是一个 json。。。显然行不通的。。。可以把页面和 json形式的token 一块发送给浏览器，这要 html 组装，也蛮麻烦的。。。更重要的是，完全可能客户端是单页应用，服务器仅仅是一个 API 服务器，两者的域名完全不同。。。
  // 所以更好的流程是让 code 经手客户端代码，而不仅仅是一个 redirect。。。callbackURL 是客户端的页面，然后页面逻辑里得到自己的 code，于是带上 code 请求服务端，让服务端带上 code 去请求微信服务器，得到 profile user，返回 json形式的token，客户端把 token 存储起来。。。不过这样有问题是（其实就算不这样，仅仅是 redirect 一样有此问题），如果微信服务器的 code 不是一次性的，那么因为 code 经过了浏览器，所以用户只要前进后退一下，就从登出变为登录了。。。当然，客户端可以在获取到 token 以后 history.replace 一下，这比单纯的 redirect 好多了
  // 其实上面两者中， code 都会经手客户端。。。无非前者只经手浏览器，后者则还要经手客户端js代码
  // 另外，一个登录服务端可能也对应多个客户端，所以需要客户端提供 callbackURL
  // 应该还有 better practice ，充分利用 iframe window.postMessage 等方法跨域
  await passport.authenticate(['wechat'], { callbackURL: req.query.callbackURL }, async (err, user, info, status) => {
    if (user) {
      let sid = uuid();
      await ctx.session({ sid, sess_name: ctx.request.body.sess_name || sid, user_id: user._id, user });
      let token = config.jwt.sign({sid, user_id: user._id}, { expiresIn: '7d', noTimestamp: true });
      ctx.body = { token, user };
    } else {
      ctx.body = info;
    }
  })(ctx, next);
}));


app.use(route.get('/me', async function(ctx, next) {
  ctx.body = await ctx.session();
}));

app.use(route.post('/me_update', async function(ctx, next) {
  await ctx.session('new_s', ctx.request.body);
  ctx.body = await ctx.session();
}));

app.use(route.post('/me_logout', async function(ctx, next) {
  await ctx.session('sid');
  ctx.body = await ctx.session();
}));

app.use(route.post('/me_change', async function(ctx, next) {
  let sid = uuid();
  await ctx.session('sid', sid);
  let sess = await ctx.session();
  let user = sess.user;
  let token = config.jwt.sign({sid, user_id: user._id}, { expiresIn: '7d', noTimestamp: true });
  ctx.body = { token, user };
}));

app.use(route.post('/register', async function(ctx, next) {
  await config.knex('users').insert(Object.assign({_id: uuid()}, ctx.request.body))
  ctx.body = 'OK';
}));

app.listen(3000);

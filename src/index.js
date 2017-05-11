require('dotenv').config();

const config = require('../config');

const uuid = require('uuid');

// const lodash = require('lodash');
const Koa = require('koa');
const route = require('koa-route');
const passport = require('koa-passport');
// const passport = require('passport');
require('./passport');

const app = new Koa();

app.use(require('koa-body')());

app.use(passport.initialize());

app.use(async function parse_jwt(ctx, next) {
  let token = (ctx.request.headers['authorization'] || '').replace('Bearer ', '');
  ctx.state.jwt = config.jwt.verify(token);
  await next();
});

// // 但是这种逻辑好像还有很多问题。。。另外 graphql 的多个 mutation 是并列事务。并列事务如何对应 session 一个事务，似乎有逻辑问题。
// app.use(async function transactions(ctx, next) {
//   // 这个中间件仅仅是为了把 session 的保存也放进事务中
//   await next();
//   commit(ctx.transactions);
//   function commit(ts) {
//     // 深度优先遍历，从而先提交子事务，后提交父事务
//     (ts.subs || []).forEach(sub_ts => commit(sub_ts));
//     ts.commit();
//   }
// });

const { default: session } = require('koa-lazy-multi-session');
const { default: Store } = require('knex-schema-session-store');
const store = new Store(config.knex, {
  schemas: [
    { name: 'user_id', type: 'string', extra: cb=>cb.notNullable() }
  ]
});

app.use(session({
  get_sid: ctx => ctx.state.jwt && ctx.state.jwt.sid,
  max_age: 7*24*60*60*1000,
  store,
}));

app.use(route.post('/login_local', async function login(ctx, next) {
  // let {user, info} = await new Promise((resolve, reject) => {
  //   passport.authenticate(['pure', 'local'], (err, user, info) => {
  //     if (err) {
  //       reject({err, info});
  //     } else {
  //       resolve({user, info});
  //     }
  //   })(ctx, next);
  // });

  // passport.authenticate 的参数本质上是 passport.authenticate(names, options | callback)，有了 callback，就无视 options，哪怕你传入了 options。。。
  // 它们两者起到的作用是一致的，都是认证结束（成功/失败）之后的操作，而且 options 中有 session:boolean 属性，就可以说明它是定义认证结束后的操作。。。所以，应该在 callback里初始化 session
  // 另外，这个 koa-passport 的 passport.authenticate 函数的 callback 函数必须是同步函数，或者返回 promise。。。
  // 于是这里，FALSE_NULL 是认证正常结束，即 callback 没有 reject，没有 throw。。。如果被 reject 或 throw，则调用 next()。。。或者说整个 promise 只要没有 resolve(false) 就 next()。而 resolve(false) 只有在传 callback，且 callback 正常结束下才会有
  // 原理
  // 看 koa-passport 和 passport 的源代码。koa-passport 中有句`middleware(req, res).then(resolve, reject)`，然后 middleware 本身内包含 callback，callback内包含这里传过去的 callback，也包含这句后面的 .then(resolve,reject) 中的 resolve,reject 。。。然后 then 的调用依赖于 middleware 内调用了 express 的 middleware(req, res, next) 的 next 函数。。。
  // 也就是 `middleware(req, res).then(resolve, reject)` 相当于 `middleware(req, res, (err, result)=>err?reject(err):resolve(result))`...
  // 然后进入 passport，而不是 koa-passport 的控制流程...在 passport 中，如果有 callback，则根本不会调用啥 next 函数。。。也就是 middleware 中自带的 callback中的 resolve,reject 与这里传的 resolve,reject 本来是可能出现重复 resolve 一个 promise 的情况的，但是因为有 callback 就无 options，不会运行 next，所以，最终不会出现重复 resolve 的情况。
  let FALSE_NULL_OR_NEXT = await passport.authenticate(['pure', 'local'], async (err, user, info, status) => {
    // 这里负责返回响应 和 持久化 session
    let sid = uuid();
    await ctx.session('sid', sid);
    await ctx.session('user_id', user._id);
    await ctx.session('user', user);
    let token = config.jwt.sign({sid, uid: user._id}, { expiresIn: '7d' });
    ctx.body = { token, user };
  })(ctx, next);
}));

// // 其实是可以这样的，但是这样就访问不到 ctx 和 next 了，不能定义 options 定义过的之外的自定义的认证结束后的操作。。。所以这种用法没有任何意义
// app.use(route.post('/login_local', passport.authenticate(['pure', 'local'], async (err, user, info, status) => {
// })));

// // 另外如果类似 express 可以有下面的写法。。。它是 authenticate 返回一个 middleware，接着一个 middleware，受上一个 middleware 控制。。。但这对于 koa 是没必要的。。。koa 也没有这种写法
// // 因为 app.use 只接收一个参数，不接受不定长参数。。。route.post 也是一样，不接受不定长函数列表参数
// app.use(route.post('/login_local', passport.authenticate(['pure', 'local'], async (err, user, info, status) => {

// }), async function(ctx, next) {

// }));

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
  let token = config.jwt.sign({sid, uid: user._id}, { expiresIn: '7d' });
  ctx.body = { token, user };
}));

app.use(route.post('/register', async function(ctx, next) {
  await config.knex('users').insert(Object.assign({_id: uuid()}, ctx.request.body))
  ctx.body = 'OK';
}));

app.listen(3000);

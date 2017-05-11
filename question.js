const fs = require('fs');

require('isomorphic-fetch');

function post(api, body) {
  return fetch(api, { method: 'post', body: JSON.stringify(body), headers: {'Content-Type':'application/json'} }).then(res => {
    if((res.status+'').startsWith('2')) {
      return res.json();
    }
    return res.json().then(errjson => {
      console.error(errjson);
      throw new Error(errjson);
    });
  })
}

function get(api) {
  return fetch(api).then(res => {
    if((res.status+'').startsWith('2')) {
      return res.json();
    }
    return res.json().then(errjson => {
      throw new Error(errjson)
    });
  })
}

function new_question(mail) {
  return post('http://hr.amiaodaifu.com:50000/1610/new-question', { mail });
}

function get_children(question_id, pid) {
  return get(`http://hr.amiaodaifu.com:50000/1610/questions/${question_id}/get-children/${pid}`).then(res => {
    // console.log(res);
    return res;
  });
}

function check(question_id, tree) {
  return post(`http://hr.amiaodaifu.com:50000/1610/questions/${question_id}/check`, { root: tree });
}

function submit(question_id, name, forFun, phone, sourceCode) {
  return post(`http://hr.amiaodaifu.com:50000/1610/questions/${question_id}/submit`, { name, forFun, phone, sourceCode });
}



function pool(concurrency, fn) {
  let working = 0, queue = [];

  function next() {
    if (working < concurrency) {
      let to_work = queue.shift();
      if (to_work) {
        let { args, resolve, reject } = to_work;
        working++;
        fn(...args).then(_ => {
          working--;
          next();
          resolve(_);
        }, _ => {
          working--;
          next();
          reject(_);
        });
      }
    }
  }

  return function (...args) {
    // console.log('args', args);
    // console.log('working', working);
    // console.log('queue', queue);
    // if (working.length < concurrency) {
    //   working.push(args);
    //   let p = fn(...args);
    //   return p.then(_ => {
    //     working.splice(working.indexOf(args), 1);
    //     next();
    //     return _;
    //   }).catch(_ => {
    //     working.splice(working.indexOf(args), 1);
    //     next();
    //     throw _;
    //   });
    // }
    let p = new Promise((resolve, reject) => {
      queue.push({ args, resolve, reject });
    });
    next();
    return p;
  }
}



const mail = 'xialvjun@live.com';
const name = '夏吕俊';
const forFun = false;
const phone = '17051096528';
const sourceCode = fs.readFileSync(__filename, 'utf-8');

const five_thread_get_children = pool(5, get_children);

async function patch_children(question_id, node) {
  // console.log('before patch node:', node);
  let rs = await five_thread_get_children(question_id, node.id);
  // console.log('test', rs);
  node.children = rs.map(cid => ({ id: cid, children: [] }));
  await Promise.all(node.children.map(cnode => patch_children(question_id, cnode)));
  // console.log('after patch node:', node);
}

(async function () {
  let { id: question_id, rootId: root_id } = await new_question(mail);

  console.log(question_id, root_id);

  const tree = { id: root_id, children: [] };

  await patch_children(question_id, tree);
  console.log(JSON.stringify(tree));
  let rs = await check(question_id, tree);
  console.log(rs);

  let {pass, concurrency, time} = rs

  if (pass) {
    let {msg} = await submit(question_id, name, forFun, phone, sourceCode);
    console.log(msg);
  }

})();

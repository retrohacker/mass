const test = require('ava');
const port = require('get-port');
const { promisify } = require('util');
const server = promisify(require("../src/index.js"));
const got = require("got");
const uuid = require('uuid');
const Aigle = require('aigle');
const config = () => ({
  "server": {
    "listen": [8000, "0.0.0.0"]
  },
  "db": {
    "user": "mart",
    "host": "localhost",
    "database": "mass",
    "port": 26257
  }
})

const getServer = async t => {
  const c = config();
  const p = await port();
  c.server.listen = [p, "0.0.0.0"];
  const s = await server(c);
  t.context.port = p;
  t.context.server = s;
  return [p, s];
}

const body = () => ({
  name: uuid.v4(),
  image: "fizzbuzz",
  stakeholders: []
});

test.beforeEach(async t => {
  const [p] = await getServer(t);
  // Create three example changesets so we can test recursion
  const changesets = [ body(), body(), body() ];
  changesets[0].stakeholders.push(changesets[1].name);
  changesets[1].stakeholders.push(changesets[2].name);
  await Aigle.resolve(changesets).each(async (v) => {
    const resp = await got.post(`http://127.0.0.1:${p}/changesets`, {
      throwHttpErrors: false,
      json: v
    }).json();
    t.not(resp.uuid, undefined, "got uuid back");
    v.uuid = resp.uuid;
  });
  t.context.changesets = changesets;
});

test.afterEach(async t => {
  await promisify(t.context.server.close);
});

test("server should 400 on missing body", async t => {
  const [p] = await getServer(t);
  const resp = await got.post(`http://127.0.0.1:${p}/repositories`, {
    throwHttpErrors: false
  });
  t.plan(1);
  t.is(400, resp.statusCode);
});

test("server should 400 on missing changeset", async t => {
  const [p] = await getServer(t);
  const resp = await got.post(`http://127.0.0.1:${p}/repositories`, {
    throwHttpErrors: false,
    json: {}
  });
  t.plan(1);
  t.is(400, resp.statusCode);
});

test("server should 400 on non-string changeset", async t => {
  const [p] = await getServer(t);
  const resp = await got.post(`http://127.0.0.1:${p}/repositories`, {
    throwHttpErrors: false,
    json: {
      changeset: 10
    }
  });
  t.plan(1);
  t.is(400, resp.statusCode);
});

test("server should 400 on non-existant changeset", async t => {
  const [p] = await getServer(t);
  const resp = await got.post(`http://127.0.0.1:${p}/repositories`, {
    throwHttpErrors: false,
    json: {
      changeset: 'does-not-exist'
    }
  });
  t.is(400, resp.statusCode);
});

test("server should return repository obj", async t => {
  const [p] = await getServer(t);
  const resp = await got.post(`http://127.0.0.1:${p}/repositories`, {
    throwHttpErrors: false,
    json: {
      changeset: t.context.changesets[0].name
    }
  }).json();
  t.true(typeof resp.name === 'string');
  t.regex(resp.head || '', /^[0-9a-zA-Z]{64}$/, 'got digest back');
});

test("server should 400 on recreating changeset", async t => {
  const [p] = await getServer(t);
  let resp = await got.post(`http://127.0.0.1:${p}/repositories`, {
    throwHttpErrors: false,
    json: {
      changeset: t.context.changesets[0].name // no deps
    }
  });
  resp = await got.post(`http://127.0.0.1:${p}/repositories`, {
    throwHttpErrors: false,
    json: {
      changeset: t.context.changesets[0].name // no deps
    }
  });
  t.is(400, resp.statusCode);
});

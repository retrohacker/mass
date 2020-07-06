const test = require('ava');
const port = require('get-port');
const { promisify } = require('util');
const server = promisify(require("../src/index.js"));
const got = require("got");
const uuid = require('uuid');
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
  name: `${(Math.random() * 1000000) | 0}`,
  image: "fizzbuzz",
  stakeholders: ["beep", "boop"]
});

test.beforeEach(async t => {
  const [p] = await getServer(t);
  const b = body();
  const resp = await got.post(`http://127.0.0.1:${p}/changesets`, {
    throwHttpErrors: false,
    json: b
  }).json();
  t.not(resp.uuid, undefined, "got uuid back");
  t.context.uuid = resp.uuid;
  t.context.body = b;
});

test.afterEach(async t => {
  await promisify(t.context.server.close);
});

test("server should return uuid on payload", async t => {
  t.plan(1);
  const { uuid, body } = t.context;
  const p = t.context.port;
  resp = await got.get(`http://127.0.0.1:${p}/changesets/${uuid}`, {
    throwHttpErrors: false,
  }).json();
  t.deepEqual(resp, body, "get returns body back after post")
});

test("server should 400 on non-existant uuid", async t => {
  t.plan(1);
  const { body } = t.context;
  const p = t.context.port;
  resp = await got.get(`http://127.0.0.1:${p}/changesets/${uuid.v4()}`, {
    throwHttpErrors: false,
  });
  t.is(resp.statusCode, 404)
});

test("server should error on invalid uuid string", async t => {
  t.plan(1);
  const { body } = t.context;
  const p = t.context.port;
  resp = await got.get(`http://127.0.0.1:${p}/changesets/foobar`, {
    throwHttpErrors: false,
  });
  t.is(resp.statusCode, 400);
});

test("server should return array on get", async t => {
  t.plan(2);
  const { body } = t.context;
  const p = t.context.port;
  resp = await got.get(`http://127.0.0.1:${p}/changesets`, {
    throwHttpErrors: false,
  }).json();
  t.assert(Array.isArray(resp.changesets), 'changesets is an array');
  t.assert(resp.changesets.length > 0, 'changesets has at least one element');
});

test("server should return changesets matching name", async t => {
  t.plan(5);
  const { body, uuid } = t.context;
  const p = t.context.port;
  resp = await got.get(`http://127.0.0.1:${p}/changesets?name=${body.name}`, {
    throwHttpErrors: false,
  }).json();
  t.assert(Array.isArray(resp.changesets), 'changesets is an array');
  t.assert(resp.changesets.length > 0, 'changesets has at least one element');
  t.truthy(resp.changesets[0].created, 'changeset includes timestamp');
  t.truthy(resp.changesets[0].uuid, 'changeset includes uuid');
  body.uuid = uuid;
  body.created = resp.changesets[0].created;
  t.deepEqual({ changesets: [ body ]}, resp);
});

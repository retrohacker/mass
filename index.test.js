const test = require('ava');
const port = require('get-port');
const { promisify } = require('util');
const server = promisify(require("./src/index.js"));
const got = require("got");
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
  t.teardown(async () => {
    await promisify(s.close);
  })
  return [p, server];
}

const body = () => ({
  name: "foobar",
  image: "fizzbuzz",
  stakeholders: ["beep", "boop"]
});

test("server should 400 on missing body", async t => {
  const [p] = await getServer(t);
  const resp = await got.post(`http://127.0.0.1:${p}/changesets`, {
    throwHttpErrors: false
  }).json();
  t.plan(1);
  t.is(400, resp.statusCode);
});

test("server should 400 on missing name", async t => {
  const [p] = await getServer(t);
  const b = body();
  delete b.name;
  const resp = await got.post(`http://127.0.0.1:${p}/changesets`, {
    throwHttpErrors: false,
    json: b
  }).json();
  t.plan(1);
  t.is(400, resp.statusCode);
});

test("server should 400 on non-string name", async t => {
  const [p] = await getServer(t);
  const b = body();
  b.name = 10;
  const resp = await got.post(`http://127.0.0.1:${p}/changesets`, {
    throwHttpErrors: false,
    json: b
  }).json();
  t.plan(1);
  t.is(400, resp.statusCode);
});

test("server should 400 on missing image", async t => {
  const [p] = await getServer(t);
  const b = body();
  delete b.image;
  const resp = await got.post(`http://127.0.0.1:${p}/changesets`, {
    throwHttpErrors: false,
    json: b
  }).json();
  t.plan(1);
  t.is(400, resp.statusCode);
});

test("server should 400 on non-string image", async t => {
  const [p] = await getServer(t);
  const b = body();
  b.image = 10;
  const resp = await got.post(`http://127.0.0.1:${p}/changesets`, {
    throwHttpErrors: false,
    json: b
  }).json();
  t.plan(1);
  t.is(400, resp.statusCode);
});

test("server should 400 on missing stakeholders", async t => {
  const [p] = await getServer(t);
  const b = body();
  delete b.stakeholders;
  const resp = await got.post(`http://127.0.0.1:${p}/changesets`, {
    throwHttpErrors: false,
    json: b
  }).json();
  t.plan(1);
  t.is(400, resp.statusCode);
});

test("server should 400 on non-array stakeholders", async t => {
  const [p] = await getServer(t);
  const b = body();
  b.stakeholders = 10;
  const resp = await got.post(`http://127.0.0.1:${p}/changesets`, {
    throwHttpErrors: false,
    json: b
  }).json();
  t.plan(1);
  t.is(400, resp.statusCode);
});

test("server should 400 on non-string-array stakeholders", async t => {
  const [p] = await getServer(t);
  const b = body();
  b.stakeholders.push(10);
  const resp = await got.post(`http://127.0.0.1:${p}/changesets`, {
    throwHttpErrors: false,
    json: b
  }).json();
  t.plan(1);
  t.is(400, resp.statusCode);
});

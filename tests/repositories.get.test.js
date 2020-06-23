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
      json: v
    }).json();
    t.not(resp.uuid, undefined, "got uuid back");
    v.uuid = resp.uuid;
  });
  // Create repository pointing to changesets
  const resp = await got.post(`http://127.0.0.1:${p}/repositories`, {
    json: {
      changeset: changesets[0].name
    }
  }).json();
  t.context.changesets = changesets;
  t.true(typeof resp.name === 'string');
  t.regex(resp.head || '', /^[0-9a-zA-Z]{64}$/, 'got digest back');
});

test.afterEach(async t => {
  await promisify(t.context.server.close);
});

test("server should return repository object", async t => {
  const p = t.context.port;
  const name = t.context.changesets[0].name;
  const resp = await got.get(`http://127.0.0.1:${p}/repositories/${name}`).json();
  t.true(typeof resp.name === 'string', 'got name back');
  t.regex(resp.head || '', /^[0-9a-zA-Z]{64}$/, 'got digest back');
});

test("server should 404 on missing repository", async t => {
  const p = t.context.port;
  const name = uuid.v4();
  const resp = await got.get(`http://127.0.0.1:${p}/repositories/${name}`, {
    throwHttpErrors: false,
  });
  t.is(resp.statusCode, 404, '404 on non-existant repo');
});

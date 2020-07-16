const test = require('ava')
const util = require('./util.js')
const got = require('got')
const uuid = require('uuid')
const { promisify } = require('util')
const Aigle = require('aigle')

const body = () => ({
  name: uuid.v4(),
  image: 'fizzbuzz',
  stakeholders: []
})

test.before(async t => {
  t.context = { ...t.context, ...(await util.getServer()) }
  t.context.port = t.context.config.server.listen[0]
})

test.after.always(async (t) => {
  await promisify(t.context.close)
})

test.beforeEach(async t => {
  const { port } = t.context
  // Create three example changesets so we can test recursion
  const changesets = [body(), body(), body()]
  changesets[0].stakeholders.push(changesets[1].name)
  changesets[1].stakeholders.push(changesets[2].name)
  await Aigle.resolve(changesets).each(async (v) => {
    const resp = await got.post(`http://127.0.0.1:${port}/changesets`, {
      throwHttpErrors: false,
      json: v
    }).json()
    t.not(resp.uuid, undefined, 'got uuid back')
    v.uuid = resp.uuid
  })
  t.context.changesets = changesets
})

test('server should 400 on missing body', async t => {
  const { port } = t.context
  const resp = await got.post(`http://127.0.0.1:${port}/repositories`, {
    throwHttpErrors: false
  })
  t.plan(1)
  t.is(400, resp.statusCode)
})

test('server should 400 on missing changeset', async t => {
  const { port } = t.context
  const resp = await got.post(`http://127.0.0.1:${port}/repositories`, {
    throwHttpErrors: false,
    json: {}
  })
  t.plan(1)
  t.is(400, resp.statusCode)
})

test('server should 400 on non-string changeset', async t => {
  const { port } = t.context
  const resp = await got.post(`http://127.0.0.1:${port}/repositories`, {
    throwHttpErrors: false,
    json: {
      changeset: 10
    }
  })
  t.plan(1)
  t.is(400, resp.statusCode)
})

test('server should 400 on non-existant changeset', async t => {
  const { port } = t.context
  const resp = await got.post(`http://127.0.0.1:${port}/repositories`, {
    throwHttpErrors: false,
    json: {
      changeset: 'does-not-exist'
    }
  })
  t.is(400, resp.statusCode)
})

test('server should return repository obj', async t => {
  const { port } = t.context
  const resp = await got.post(`http://127.0.0.1:${port}/repositories`, {
    throwHttpErrors: false,
    json: {
      changeset: t.context.changesets[0].name
    }
  }).json()
  t.true(typeof resp.name === 'string')
  t.regex(resp.head || '', /^[0-9a-zA-Z]{64}$/, 'got digest back')
})

test('server should 400 on recreating changeset', async t => {
  const { port } = t.context
  let resp = await got.post(`http://127.0.0.1:${port}/repositories`, {
    throwHttpErrors: false,
    json: {
      changeset: t.context.changesets[0].name // no deps
    }
  })
  resp = await got.post(`http://127.0.0.1:${port}/repositories`, {
    throwHttpErrors: false,
    json: {
      changeset: t.context.changesets[0].name // no deps
    }
  })
  t.is(400, resp.statusCode)
})

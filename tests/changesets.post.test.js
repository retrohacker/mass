const test = require('ava')
const got = require('got')
const util = require('./util.js')
const { promisify } = require('util')

const body = () => ({
  name: 'foobar',
  image: 'fizzbuzz',
  stakeholders: ['beep', 'boop']
})

test.before(async t => {
  t.context = { ...t.context, ...(await util.getServer()) }
  t.context.port = t.context.config.server.listen[0]
})

test.after.always(async (t) => {
  await promisify(t.context.close)
})

test('server should 400 on missing body', async t => {
  const { port } = t.context
  const b = body()
  delete b.name
  const resp = await got.post(`http://127.0.0.1:${port}/changesets`, {
    throwHttpErrors: false,
    json: b
  })
  t.plan(1)
  t.is(400, resp.statusCode)
})

test('server should 400 on non-string name', async t => {
  const { port } = t.context
  const b = body()
  b.name = 10
  const resp = await got.post(`http://127.0.0.1:${port}/changesets`, {
    throwHttpErrors: false,
    json: b
  })
  t.plan(1)
  t.is(400, resp.statusCode)
})

test('server should 400 on invalid name', async t => {
  const { port } = t.context
  const b = body()
  b.name = '@invalid/name'
  const resp = await got.post(`http://127.0.0.1:${port}/changesets`, {
    throwHttpErrors: false,
    json: b
  })
  t.plan(1)
  t.is(400, resp.statusCode)
})

test('server should 400 on missing image', async t => {
  const { port } = t.context
  const b = body()
  delete b.image
  const resp = await got.post(`http://127.0.0.1:${port}/changesets`, {
    throwHttpErrors: false,
    json: b
  })
  t.plan(1)
  t.is(400, resp.statusCode)
})

test('server should 400 on non-string image', async t => {
  const { port } = t.context
  const b = body()
  b.image = 10
  const resp = await got.post(`http://127.0.0.1:${port}/changesets`, {
    throwHttpErrors: false,
    json: b
  })
  t.plan(1)
  t.is(400, resp.statusCode)
})

test('server should 400 on missing stakeholders', async t => {
  const { port } = t.context
  const b = body()
  delete b.stakeholders
  const resp = await got.post(`http://127.0.0.1:${port}/changesets`, {
    throwHttpErrors: false,
    json: b
  })
  t.plan(1)
  t.is(400, resp.statusCode)
})

test('server should 400 on non-array stakeholders', async t => {
  const { port } = t.context
  const b = body()
  b.stakeholders = 10
  const resp = await got.post(`http://127.0.0.1:${port}/changesets`, {
    throwHttpErrors: false,
    json: b
  })
  t.plan(1)
  t.is(400, resp.statusCode)
})

test('server should 400 on non-string-array stakeholders', async t => {
  const { port } = t.context
  const b = body()
  b.stakeholders.push(10)
  const resp = await got.post(`http://127.0.0.1:${port}/changesets`, {
    throwHttpErrors: false,
    json: b
  })
  t.plan(1)
  t.is(400, resp.statusCode)
})

test('server should return uuid on payload', async t => {
  const { port } = t.context
  const b = body()
  const resp = await got.post(`http://127.0.0.1:${port}/changesets`, {
    throwHttpErrors: false,
    json: b
  }).json()
  t.plan(1)
  t.not(resp.uuid, undefined, 'got uuid back')
})

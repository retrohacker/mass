const test = require('ava')
const got = require('got')
const uuid = require('uuid')
const util = require('./util.js')

const changeset = () => ({
  name: `${(Math.random() * 1000000) | 0}`,
  image: 'fizzbuzz',
  stakeholders: ['beep', 'boop']
})

test.before(async t => {
  t.context.config = await util.getServer()
  t.context.port = t.context.config.server.listen[0]
})

test.after.always(async () => {
  util.releaseServer()
})

test.beforeEach(async t => {
  const { port } = t.context
  const body = changeset()
  const resp = await got.post(`http://127.0.0.1:${port}/changesets`, {
    throwHttpErrors: false,
    json: body
  }).json()
  t.not(resp.uuid, undefined, 'got uuid back')
  t.context.uuid = resp.uuid
  t.context.body = body
})

test('server should return uuid on payload', async t => {
  t.plan(1)
  const { uuid, body, port } = t.context
  const resp = await got.get(`http://127.0.0.1:${port}/changesets/${uuid}`, {
    throwHttpErrors: false
  }).json()
  t.deepEqual(resp, body, 'get returns body back after post')
})

test('server should 400 on non-existant uuid', async t => {
  t.plan(1)
  const { port } = t.context
  const resp = await got.get(`http://127.0.0.1:${port}/changesets/${uuid.v4()}`, {
    throwHttpErrors: false
  })
  t.is(resp.statusCode, 404)
})

test('server should error on invalid uuid string', async t => {
  t.plan(1)
  const { port } = t.context
  const resp = await got.get(`http://127.0.0.1:${port}/changesets/foobar`, {
    throwHttpErrors: false
  })
  t.is(resp.statusCode, 400)
})

test('server should return array on get', async t => {
  t.plan(2)
  const { port } = t.context
  const resp = await got.get(`http://127.0.0.1:${port}/changesets`, {
    throwHttpErrors: false
  }).json()
  t.assert(Array.isArray(resp.changesets), 'changesets is an array')
  t.assert(resp.changesets.length > 0, 'changesets has at least one element')
})

test('server should return changesets matching name', async t => {
  t.plan(5)
  const { body, uuid, port } = t.context
  const resp = await got.get(`http://127.0.0.1:${port}/changesets?name=${body.name}`, {
    throwHttpErrors: false
  }).json()
  t.assert(Array.isArray(resp.changesets), 'changesets is an array')
  t.assert(resp.changesets.length > 0, 'changesets has at least one element')
  t.truthy(resp.changesets[0].created, 'changeset includes timestamp')
  t.truthy(resp.changesets[0].uuid, 'changeset includes uuid')
  body.uuid = uuid
  body.created = resp.changesets[0].created
  t.deepEqual({ changesets: [body] }, resp)
})

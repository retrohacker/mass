const test = require('ava')
const { promisify } = require('util')
const util = require('./util.js')
const got = require('got')
const uuid = require('uuid')
const crypto = require('crypto')
const Aigle = require('aigle')
const pino = require('pino')

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
  const port = t.context.port
  // Create three example changesets so we can test recursion
  const changesets = [body(), body(), body()]
  changesets[0].stakeholders.push(changesets[1].name)
  changesets[1].stakeholders.push(changesets[2].name)
  await Aigle.resolve(changesets).each(async (v) => {
    const resp = await got.post(`http://127.0.0.1:${port}/changesets`, {
      json: v
    }).json()
    t.not(resp.uuid, undefined, 'got uuid back')
    v.uuid = resp.uuid
  })
  // Create repository pointing to changesets
  const resp = await got.post(`http://127.0.0.1:${port}/repositories`, {
    json: {
      changeset: changesets[0].name
    }
  }).json()
  t.context.changesets = changesets
  t.true(typeof resp.name === 'string')
  t.regex(resp.head || '', /^[0-9a-zA-Z]{64}$/, 'got digest back')
  t.context.commit = resp.head
})

test('server should return repository object', async t => {
  const port = t.context.port
  const name = t.context.changesets[0].name
  const resp = await got.get(`http://127.0.0.1:${port}/repositories/${name}`).json()
  t.true(typeof resp.name === 'string', 'got name back')
  t.regex(resp.head || '', /^[0-9a-zA-Z]{64}$/, 'got digest back')
})

test('server should 404 on missing repository', async t => {
  const port = t.context.port
  const name = uuid.v4()
  const resp = await got.get(`http://127.0.0.1:${port}/repositories/${name}`, {
    throwHttpErrors: false
  })
  t.is(resp.statusCode, 404, '404 on non-existant repo')
})

test('server should return list of repositories', async t => {
  const port = t.context.port
  const resp = await got.get(`http://127.0.0.1:${port}/repositories`).json()
  t.true(Array.isArray(resp.repositories), 'got list of repositories back')
  t.true(resp.repositories.length > 1, 'get back at least the one we created')
})

test('server should return list of commits', async t => {
  const port = t.context.port
  const name = t.context.changesets[0].name
  const url = `http://127.0.0.1:${port}/repositories/${name}/commits`
  const resp = await got.get(url).json()
  t.true(Array.isArray(resp.commits), 'got list of commits back')
  const repository = await got.get(`http://127.0.0.1:${port}/repositories/${name}`).json()
  t.deepEqual([{
    digest: repository.head,
    created: resp.commits[0].created,
    parent: null
  }], resp.commits, 'get back HEAD')
  t.true((typeof resp.commits[0].created) === 'string', 'got back timestamp')
})

test('server should 404 list of commits for non-existant repo', async t => {
  const port = t.context.port
  const name = uuid.v4()
  const url = `http://127.0.0.1:${port}/repositories/${name}/commits`
  const resp = await got.get(url, {
    throwHttpErrors: false
  })
  t.is(resp.statusCode, 404, '404 on non-existant repo')
})

test('server should return commit', async t => {
  const port = t.context.port
  const name = t.context.changesets[0].name
  const commit = t.context.commit
  const url = `http://127.0.0.1:${port}/repositories/${name}/commits/${commit}`
  const resp = await got.get(url).json()
  t.true(Array.isArray(resp.changesets), 'result included changesets')
  t.is(typeof resp.created, 'string', 'result included creation timestamp')
  // Sort the changesets so we can compare them in a deep equal
  resp.changesets = resp.changesets.sort()
  // Remove the timestamp because we cant deep equal that
  delete resp.created
  t.deepEqual({
    digest: commit,
    parent: null,
    changesets: t.context.changesets.map(v => v.uuid).sort()
  }, resp, 'got back a commit object')
})

test('server should paginate commits', async t => {
  // Create our own connection to the database
  const db = promisify(require('../src/db'))
  const config = JSON.parse(JSON.stringify(t.context.config))
  config.log = pino(config.log)
  const pool = await db(config)
  const root = t.context.commit
  const port = t.context.port
  const name = t.context.changesets[0].name
  t.teardown(async () => await pool.end())
  const digest = () => crypto
    .createHash('sha256')
    .update(uuid.v4())
    .digest('hex')
  // Insert a few hundred commits :upside_smile:
  // Generate query
  let query = 'INSERT INTO commits (digest, parent, changesets) VALUES '
  const valueQuery = []
  let index = 1
  for (let i = 0; i < 25; i++) {
    valueQuery.push(`($${index++}, $${index++}, $${index++})`)
  }
  query += valueQuery.join(', ')
  let next = digest()
  let prev = null
  const requests = []
  for (let i = 0; i < 10; i++) {
    const request = []
    // Batch the request
    for (let j = 0; j < 25; j++) {
      request.push(next, prev, [])
      prev = next
      next = digest()
    }
    requests.push(request)
  }
  await Aigle.resolve(requests).each((request) => pool.query(query, request))
  const updateQuery = 'UPDATE commits SET parent = $1 WHERE digest = $2'
  await pool.query(updateQuery, [prev, root])

  // Now we have 250 commits to query, make sure our request only returns 100
  const url = `http://127.0.0.1:${port}/repositories/${name}/commits`
  let resp = await got.get(url).json()
  t.true(Array.isArray(resp.commits), 'got list of commits back')
  t.is(resp.commits.length, 100, 'got back 100 entries')
  // Get the next 100 values
  let last = resp.commits.pop()
  t.not(last.parent, null, 'last element should have a parent')
  resp = await got.get(url + `?from=${last.parent}`).json()
  t.true(Array.isArray(resp.commits), 'got list of commits back')
  t.is(resp.commits.length, 100, 'got back next 100 entries')
  // Get the last 50 values
  last = resp.commits.pop()
  t.not(last.parent, null, 'last element should have a parent')
  resp = await got.get(url + `?from=${last.parent}`).json()
  t.true(Array.isArray(resp.commits), 'got list of commits back')
  t.is(resp.commits.length, 51, 'got back last 51 entries')
})

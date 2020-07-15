const test = require('ava')
const { promisify } = require('util')
const got = require('got')
const uuid = require('uuid')
const wait = promisify(setTimeout)
const util = require('./util.js')

const body = () => ({
  name: uuid.v4(),
  image: 'fizzbuzz',
  stakeholders: []
})

const mkChangeset = async (port, b) => {
  b = b || body()
  const resp = await got.post(`http://127.0.0.1:${port}/changesets`, {
    json: b
  }).json()
  if (!resp || !resp.uuid) {
    throw new Error('did not get uuid back')
  }
  b.uuid = resp.uuid
  return b
}

const mkRepository = async (port, name) => {
  return await got.post(`http://127.0.0.1:${port}/repositories`, {
    json: {
      changeset: name
    }
  }).json()
}

test.before(async t => {
  t.context = { ...t.context, ...(await util.getServer()) }
  t.context.port = t.context.config.server.listen[0]
})

test.after.always(async (t) => {
  await promisify(t.context.server.close)
})

test('Server should generate change campaign', async t => {
  const p = t.context.port
  // Create a changeset and a repository
  const changeset = await mkChangeset(p)
  const repository = await mkRepository(p, changeset.name)
  // Push an update the the changeset
  const update = body()
  update.name = changeset.name
  const { uuid } = await got.post(`http://127.0.0.1:${p}/changesets`, { json: update }).json()
  t.true((typeof uuid) === 'string', 'uuid is string')
  let commits = []
  for (let i = 0; i < 100; i++) {
    await wait(100) // Give campaign time to run
    // Verify the repository now has two commits
    commits = (await got.get(`http://127.0.0.1:${p}/repositories/${repository.name}/commits`).json()).commits
    if (commits.length > 1) break
  }
  // Verify we generated a change campaign
  const campaign = await got.get(`http://127.0.0.1:${p}/campaigns/${uuid}`).json()
  t.true(typeof campaign === 'object', 'got campaign back')
  t.true(Array.isArray(campaign['pull-requests']), 'campaign contains array of pull-requests')
  t.is(campaign['pull-requests'].length, 1, 'generated one pull-request')
})

test('Server should generate change campaign for deps', async t => {
  const p = t.context.port
  // Create a changeset with a stakeholder and a repository
  let stakeholder = body()
  let parent = body()
  parent.stakeholders.push(stakeholder.name)
  stakeholder = await mkChangeset(p, stakeholder)
  parent = await mkChangeset(p, parent)
  const repository = await mkRepository(p, parent.name)
  // Push an update the the stakeholder
  const update = body()
  update.name = stakeholder.name
  const { uuid } = await got.post(`http://127.0.0.1:${p}/changesets`, { json: update }).json()
  t.true((typeof uuid) === 'string', 'uuid is string')
  let commits = []
  for (let i = 0; i < 100; i++) {
    await wait(100) // Give campaign time to run
    // Verify the repository now has two commits
    commits = (await got.get(`http://127.0.0.1:${p}/repositories/${repository.name}/commits`).json()).commits
    if (commits.length > 1) break
  }
  t.is(commits.length, 2, 'got two commits back for repository')
  // Verify we generated a change campaign
  const campaign = await got.get(`http://127.0.0.1:${p}/campaigns/${uuid}`).json()
  t.true(typeof campaign === 'object', 'got campaign back')
  t.true(Array.isArray(campaign['pull-requests']), 'campaign contains array of pull-requests')
  t.is(campaign['pull-requests'].length, 1, 'generated one pull-request')
  const { changesets } = await got.get(`http://127.0.0.1:${p}/repositories/${parent.name}/commits/${commits[0].digest}`).json()
  t.true(Array.isArray(changesets), 'commit object includes array of changesets')
  t.is(changesets.length, 2, 'commit contain two changesets')
})

test('Should support removing stakeholders', async t => {
  const p = t.context.port
  // Create a changeset with a stakeholder and a repository
  let stakeholder = body()
  let parent = body()
  parent.stakeholders.push(stakeholder.name)
  stakeholder = await mkChangeset(p, stakeholder)
  parent = await mkChangeset(p, parent)
  const repository = await mkRepository(p, parent.name)
  // Push an update the the parent that has no stakeholders
  const update = body()
  update.name = parent.name
  const { uuid } = await got.post(`http://127.0.0.1:${p}/changesets`, { json: update }).json()
  t.true((typeof uuid) === 'string', 'uuid is string')
  let commits = []
  for (let i = 0; i < 100; i++) {
    await wait(100) // Give campaign time to run
    // Verify the repository now has two commits
    commits = (await got.get(`http://127.0.0.1:${p}/repositories/${repository.name}/commits`).json()).commits
    if (commits.length > 1) break
  }
  t.is(commits.length, 2, 'got two commits back for repository')
  // Verify we generated a change campaign
  const campaign = await got.get(`http://127.0.0.1:${p}/campaigns/${uuid}`).json()
  t.true(typeof campaign === 'object', 'got campaign back')
  t.true(Array.isArray(campaign['pull-requests']), 'campaign contains array of pull-requests')
  t.is(campaign['pull-requests'].length, 1, 'generated one pull-request')
  const { changesets } = await got.get(`http://127.0.0.1:${p}/repositories/${parent.name}/commits/${commits[0].digest}`).json()
  t.true(Array.isArray(changesets), 'commit object includes array of changesets')
  t.is(changesets.length, 1, 'commit only contains one changeset')
})

test('Should support adding stakeholders', async t => {
  const p = t.context.port
  // Create a changeset with a stakeholder and a repository
  let stakeholder = body()
  let parent = body()
  stakeholder = await mkChangeset(p, stakeholder)
  parent = await mkChangeset(p, parent)
  const repository = await mkRepository(p, parent.name)
  // Push an update the the parent that has no stakeholders
  const update = body()
  update.name = parent.name
  update.stakeholders.push(stakeholder.name)
  const { uuid } = await got.post(`http://127.0.0.1:${p}/changesets`, { json: update }).json()
  t.true((typeof uuid) === 'string', 'uuid is string')
  let commits = []
  for (let i = 0; i < 100; i++) {
    await wait(100) // Give campaign time to run
    // Verify the repository now has two commits
    commits = (await got.get(`http://127.0.0.1:${p}/repositories/${repository.name}/commits`).json()).commits
    if (commits.length > 1) break
  }
  t.is(commits.length, 2, 'got two commits back for repository')
  // Verify we generated a change campaign
  const campaign = await got.get(`http://127.0.0.1:${p}/campaigns/${uuid}`).json()
  t.true(typeof campaign === 'object', 'got campaign back')
  t.true(Array.isArray(campaign['pull-requests']), 'campaign contains array of pull-requests')
  t.is(campaign['pull-requests'].length, 1, 'generated one pull-request')
  const { changesets } = await got.get(`http://127.0.0.1:${p}/repositories/${parent.name}/commits/${commits[0].digest}`).json()
  t.true(Array.isArray(changesets), 'commit object includes array of changesets')
  t.is(changesets.length, 2, 'commit should contain two changesets')
})

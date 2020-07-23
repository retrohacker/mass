const test = require('ava')
const { promisify } = require('util')
const got = require('got')
const util = require('./util.js')
const campaign = require('../src/campaign.js')

const body = () => ({
  name: util.uuid(),
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
      artifactName: name,
      changeset: name
    }
  }).json()
}

test.before(async t => {
  t.context = { ...t.context, ...(await util.getServer()) }
  t.context.port = t.context.config.server.listen[0]
})

test.after.always(async (t) => {
  await promisify(t.context.close)
})

test('Server should generate change campaign', async t => {
  const { port, pool, log } = t.context
  // Create a changeset and a repository
  const changeset = await mkChangeset(port)
  const repository = await mkRepository(port, changeset.name)
  // Push an update the the changeset
  const update = body()
  update.name = changeset.name
  const { uuid } = await got.post(`http://127.0.0.1:${port}/changesets`, { json: update }).json()
  t.true((typeof uuid) === 'string', 'uuid is string')
  let commits = []
  await promisify(campaign)(pool, log)
  // Verify the repository now has two commits
  commits = (await got.get(`http://127.0.0.1:${port}/repositories/${repository.name}/commits`).json()).commits
  t.is(commits.length, 2, 'got two commits back for repository')
  // Verify we generated a change campaign
  const changeCampaign = await got.get(`http://127.0.0.1:${port}/campaigns/${uuid}`).json()
  t.true(typeof changeCampaign === 'object', 'got campaign back')
  t.true(Array.isArray(changeCampaign['pull-requests']), 'campaign contains array of pull-requests')
  t.is(changeCampaign['pull-requests'].length, 1, 'generated one pull-request')
})

test('Server should generate change campaign for deps', async t => {
  const { port, pool, log } = t.context
  // Create a changeset with a stakeholder and a repository
  let stakeholder = body()
  let parent = body()
  parent.stakeholders.push(stakeholder.name)
  stakeholder = await mkChangeset(port, stakeholder)
  parent = await mkChangeset(port, parent)
  const repository = await mkRepository(port, parent.name)
  // Push an update the the stakeholder
  const update = body()
  update.name = stakeholder.name
  const { uuid } = await got.post(`http://127.0.0.1:${port}/changesets`, { json: update }).json()
  t.true((typeof uuid) === 'string', 'uuid is string')
  let commits = []
  await promisify(campaign)(pool, log)
  // Verify the repository now has two commits
  commits = (await got.get(`http://127.0.0.1:${port}/repositories/${repository.name}/commits`).json()).commits
  t.is(commits.length, 2, 'got two commits back for repository')
  // Verify we generated a change campaign
  const changeCampaign = await got.get(`http://127.0.0.1:${port}/campaigns/${uuid}`).json()
  t.true(typeof changeCampaign === 'object', 'got campaign back')
  t.true(Array.isArray(changeCampaign['pull-requests']), 'campaign contains array of pull-requests')
  t.is(changeCampaign['pull-requests'].length, 1, 'generated one pull-request')
  const { changesets } = await got.get(`http://127.0.0.1:${port}/repositories/${parent.name}/commits/${commits[0].digest}`).json()
  t.true(Array.isArray(changesets), 'commit object includes array of changesets')
  t.is(changesets.length, 2, 'commit contain two changesets')
})

test('Should support removing stakeholders', async t => {
  const { port, pool, log } = t.context
  // Create a changeset with a stakeholder and a repository
  let stakeholder = body()
  let parent = body()
  parent.stakeholders.push(stakeholder.name)
  stakeholder = await mkChangeset(port, stakeholder)
  parent = await mkChangeset(port, parent)
  const repository = await mkRepository(port, parent.name)
  // Push an update the the parent that has no stakeholders
  const update = body()
  update.name = parent.name
  const { uuid } = await got.post(`http://127.0.0.1:${port}/changesets`, { json: update }).json()
  t.true((typeof uuid) === 'string', 'uuid is string')
  let commits = []
  await promisify(campaign)(pool, log)
  // Verify we now have two commits
  commits = (await got.get(`http://127.0.0.1:${port}/repositories/${repository.name}/commits`).json()).commits
  t.is(commits.length, 2, 'got two commits back for repository')
  // Verify we generated a change campaign
  const changeCampaign = await got.get(`http://127.0.0.1:${port}/campaigns/${uuid}`).json()
  t.true(typeof changeCampaign === 'object', 'got campaign back')
  t.true(Array.isArray(changeCampaign['pull-requests']), 'campaign contains array of pull-requests')
  t.is(changeCampaign['pull-requests'].length, 1, 'generated one pull-request')
  const { changesets } = await got.get(`http://127.0.0.1:${port}/repositories/${parent.name}/commits/${commits[0].digest}`).json()
  t.true(Array.isArray(changesets), 'commit object includes array of changesets')
  t.is(changesets.length, 1, 'commit only contains one changeset')
})

test('Should support adding stakeholders', async t => {
  const { port, pool, log } = t.context
  // Create a changeset with a stakeholder and a repository
  let stakeholder = body()
  let parent = body()
  stakeholder = await mkChangeset(port, stakeholder)
  parent = await mkChangeset(port, parent)
  const repository = await mkRepository(port, parent.name)
  // Push an update the the parent that has no stakeholders
  const update = body()
  update.name = parent.name
  update.stakeholders.push(stakeholder.name)
  const { uuid } = await got.post(`http://127.0.0.1:${port}/changesets`, { json: update }).json()
  t.true((typeof uuid) === 'string', 'uuid is string')
  let commits = []
  await promisify(campaign)(pool, log)
  // Verify the repository now has two commits
  commits = (await got.get(`http://127.0.0.1:${port}/repositories/${repository.name}/commits`).json()).commits
  t.is(commits.length, 2, 'got two commits back for repository')
  // Verify we generated a change campaign
  const changeCampaign = await got.get(`http://127.0.0.1:${port}/campaigns/${uuid}`).json()
  t.true(typeof changeCampaign === 'object', 'got campaign back')
  t.true(Array.isArray(changeCampaign['pull-requests']), 'campaign contains array of pull-requests')
  t.is(changeCampaign['pull-requests'].length, 1, 'generated one pull-request')
  const { changesets } = await got.get(`http://127.0.0.1:${port}/repositories/${parent.name}/commits/${commits[0].digest}`).json()
  t.true(Array.isArray(changesets), 'commit object includes array of changesets')
  t.is(changesets.length, 2, 'commit should contain two changesets')
})

test.cb('Campaign should support callbacks', t => {
  const { pool, log } = t.context
  campaign(pool, log, t.end)
})

test.cb('Campaign should correctly juggle multiple callbacks', t => {
  t.plan(4)
  const { pool, log } = t.context
  let i = 0
  // This makes sure we are already running when we kick off this test, it
  // forces these tests to be deterministc by ensuring our "first test" is
  // always initially in the callbacks.next array
  campaign(pool, log, () => {})
  campaign(pool, log, () => {
    t.is(i++, 0, 'invoked first campaign first')
  })
  campaign(pool, log, () => {
    t.is(i++, 1, 'invoked second campaign second')
    campaign(pool, log, () => {
      t.is(i++, 2, 'invoked third campaign third')
      setImmediate(() => {
        campaign(pool, log, () => {
          t.is(i++, 3, 'invoked fourth campaign fourth')
          t.end()
        })
      })
    })
  })
})

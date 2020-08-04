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

const mkTree = async (port, name, node) => {
  const names = []
  for (const key in node) {
    const keyName = `${key}-${util.uuid()}`
    await mkTree(port, keyName, node[key])
    names.push(keyName)
  }
  const resp = await mkChangeset(port, {
    name: name,
    image: Object.keys(node).length ? '' : name,
    stakeholders: names
  })
  node.name = name
  node.image = resp.image
  node.uuid = resp.uuid
}

const preorderTraversal = (root) => {
  const uuids = []
  ;(function traverse (node) {
    uuids.push(node.uuid)
    for (const key in node) {
      if (key === 'name' || key === 'image' || key === 'uuid') {
        continue
      }
      traverse(node[key])
    }
  })(root)
  return uuids
}

test.before(async t => {
  t.context = { ...t.context, ...(await util.getServer()) }
  t.context.port = t.context.config.server.listen[0]
})

test.after.always(async (t) => {
  await promisify(t.context.close)
})

test('New stakeholder should pick up latest changeset', async t => {
  const { port, pool, log } = t.context
  // Create a transitive dependency
  const transitiveOld = await mkChangeset(port)
  const transitiveNew = await mkChangeset(port, {
    name: transitiveOld.name,
    image: transitiveOld.image,
    stakeholders: []
  })
  // Create a changeset and a repository, but don't depend on the transitive
  // yet.
  const headOld = await mkChangeset(port)
  const repository = await mkRepository(port, headOld.name)
  // Update the root changeset to depend on the transitive.
  const headNew = await mkChangeset(port, {
    name: headOld.name,
    image: headOld.image,
    stakeholders: [transitiveOld.name]
  })
  let commits = []
  await promisify(campaign)(pool, log)
  // Verify the repository now has two commits
  commits = (await got.get(`http://127.0.0.1:${port}/repositories/${repository.name}/commits`).json()).commits
  t.is(commits.length, 2, 'got two commits back for repository')
  // Verify the head commit has two changesets
  const head = (await got.get(`http://127.0.0.1:${port}/repositories/${repository.name}/commits/${commits[0].digest}`).json())
  t.is(head.changesets.length, 2, 'got two changesets back for head commit')
  // Verify that the new transitive was picked up
  t.deepEqual(head.changesets.sort(), [headNew.uuid, transitiveNew.uuid].sort())
})

test('Server should generate a commit that has correct changesets and correctly ordered', async t => {
  const root = {
    bag: {
      apple: {},
      banana: {}
    },
    coconut: {},
    basket: {
      durian: {}
    }
  }
  // Create tree of changesets and repository
  const { port, pool, log } = t.context
  const rootName = `root-${util.uuid()}`
  await mkTree(port, rootName, root)
  const repository = await mkRepository(port, rootName)
  // Verify the repository now has one commit
  const commits = (await got.get(`http://127.0.0.1:${port}/repositories/${repository.name}/commits`).json()).commits
  t.is(commits.length, 1, 'got one commits back for repository')
  // Verify that the commit generated is ordered by preorder traversal
  let head = (await got.get(`http://127.0.0.1:${port}/repositories/${repository.name}/commits/${commits[0].digest}`).json())
  t.deepEqual(head.changesets, preorderTraversal(root))
  // (1) Verify that we can update a single changeset without affecting its transitives
  let pr = await mkChangeset(port, {
    name: root.bag.name,
    image: root.bag.image,
    stakeholders: [root.bag.apple.name, root.bag.banana.name]
  })
  root.bag.uuid = pr.uuid
  await promisify(campaign)(pool, log)
  let pullrequests = (await got.get(`http://127.0.0.1:${port}/campaigns/${pr.uuid}`).json())['pull-requests']
  t.is(pullrequests.length, 1, 'got one pull request back')
  head = (await got.get(`http://127.0.0.1:${port}/repositories/${repository.name}/commits/${pullrequests[0].commit}`).json())
  t.deepEqual(head.changesets, preorderTraversal(root))
  // (2) Verify we can add a stakeholder
  const eggplant = await mkChangeset(port)
  pr = await mkChangeset(port, {
    name: root.bag.name,
    image: root.bag.image,
    stakeholders: [root.bag.apple.name, root.bag.banana.name, eggplant.name]
  })
  root.bag.uuid = pr.uuid
  delete eggplant.stakeholders
  root.bag.eggplant = eggplant
  await promisify(campaign)(pool, log)
  pullrequests = (await got.get(`http://127.0.0.1:${port}/campaigns/${pr.uuid}`).json())['pull-requests']
  t.is(pullrequests.length, 1, 'got one pull request back')
  head = (await got.get(`http://127.0.0.1:${port}/repositories/${repository.name}/commits/${pullrequests[0].commit}`).json())
  t.deepEqual(head.changesets, preorderTraversal(root))
  // (3) Verify we can remove a stakeholder
  delete root.bag.apple
  pr = await mkChangeset(port, {
    name: root.bag.name,
    image: root.bag.image,
    stakeholders: [root.bag.banana.name, eggplant.name]
  })
  root.bag.uuid = pr.uuid
  await promisify(campaign)(pool, log)
  pullrequests = (await got.get(`http://127.0.0.1:${port}/campaigns/${pr.uuid}`).json())['pull-requests']
  t.is(pullrequests.length, 1, 'got one pull request back')
  head = (await got.get(`http://127.0.0.1:${port}/repositories/${repository.name}/commits/${pullrequests[0].commit}`).json())
  t.deepEqual(head.changesets, preorderTraversal(root))
  // (4) Verify we can add a subtree
  root.container = {
    pocket: {
      fig: {},
      grape: {}
    }
  }
  const containerName = `container-${util.uuid()}`
  await mkTree(port, containerName, root.container)
  pr = await mkChangeset(port, {
    name: root.name,
    image: root.image,
    stakeholders: [root.bag.name, root.coconut.name, root.basket.name, root.container.name]
  })
  root.uuid = pr.uuid
  await promisify(campaign)(pool, log)
  pullrequests = (await got.get(`http://127.0.0.1:${port}/campaigns/${pr.uuid}`).json())['pull-requests']
  t.is(pullrequests.length, 1, 'got one pull request back')
  head = (await got.get(`http://127.0.0.1:${port}/repositories/${repository.name}/commits/${pullrequests[0].commit}`).json())
  t.deepEqual(head.changesets, preorderTraversal(root))
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

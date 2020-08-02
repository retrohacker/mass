const test = require('ava')
const hlb = require('../src/hlb')
const util = require('./util')

const mockCommit = () => ({
  artifactName: `localhost:5000/mass/test-${util.uuid()}`,
  changesets: [
    {
      name: 'baseos',
      image: 'localhost:5000/mass/baseos'
    },
    {
      name: 'platform',
      image: 'localhost:5000/mass/platform'
    },
    {
      name: 'service',
      image: 'localhost:5000/mass/service'
    }
  ]
})

const mockBadIdentCommit = () => ({
  artifactName: `localhost:5000/mass/test-${util.uuid()}`,
  changesets: [
    {
      name: '@baseos-stake',
      image: 'localhost:5000/mass/baseos'
    }
  ]
})

test('should include titus for non-qualified artifactName', async t => {
  const commit = mockCommit()
  commit.artifactName = 'foo'
  const result = hlb.generateHlb(commit)
  t.assert(result.indexOf('import titus from') >= 0)
  t.assert(result.indexOf('titus.registryPush') >= 0)
})

test('should not include titus for fully-qualified commit', async t => {
  const commit = mockCommit()
  const result = hlb.generateHlb(commit)
  t.assert(result.indexOf('import titus from') === -1)
})

test('should invoke all changesets', async t => {
  const commit = mockCommit()
  const result = hlb.generateHlb(commit)
  commit.changesets.forEach(changeset => {
    t.assert(result.indexOf(`import ${changeset.name} from fs`) >= 0)
    t.assert(result.indexOf(`${changeset.name}.stake`) >= 0)
  })
})

test('should exclude stake if it has no image', async t => {
  const commit = mockCommit()
  commit.changesets[0].image = ''
  const result = hlb.generateHlb(commit)
  t.assert(result.indexOf(`import ${hlb.sanitizeIdent(commit.changesets[0].name)}`) < 0)
  t.assert(result.indexOf(`${hlb.sanitizeIdent(commit.changesets[0].name)}.stake`) < 0)
})

test('should sanitize identifiers for hlb', async t => {
  const commit = mockBadIdentCommit()
  const result = hlb.generateHlb(commit)
  t.assert(result.indexOf('import _baseos_stake from') >= 0)
  t.assert(result.indexOf('_baseos_stake.stake') >= 0)
})

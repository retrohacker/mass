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

test('should include titus for non-qualified artifactName', async t => {
  const commit = mockCommit()
  commit.artifactName = 'foo'
  const result = hlb.generateHlb(commit)
  t.assert(result.indexOf('import titus from') >= 0)
  t.assert(result.indexOf('titus.registryPush') >= 0)
})

test('should include titus for non-qualified image', async t => {
  const commit = mockCommit()
  commit.changesets[0].image = 'bar'
  const result = hlb.generateHlb(commit)
  t.assert(result.indexOf('import titus from') >= 0)
  t.assert(result.indexOf('titus.registryImage') >= 0)
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

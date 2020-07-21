const test = require('ava')
const hlb = require('../src/hlb')
const uuid = require('uuid')
const path = require('path')
const execa = require('execa')
const { Aigle } = require('aigle')
const { promisify } = require('util')

const mockCommit = () => ({
  artifactName: `localhost:5000/mass/test-${uuid.v4()}`,
  changesets: [
    {
      name: 'bottom',
      image: 'localhost:5000/mass/bottom'
    },
    {
      name: 'middle',
      image: 'localhost:5000/mass/middle'
    },
    {
      name: 'top',
      image: 'localhost:5000/mass/top'
    }
  ]
})

test.before('build images', async t => {
  const bottom = path.join(__dirname, 'changesets', 'bottom')
  const middle = path.join(__dirname, 'changesets', 'middle')
  const top = path.join(__dirname, 'changesets', 'top')
  await Aigle.parallel([
    async () => await execa('hlb', ['run', '--target=build', 'changeset.hlb'], { cwd: bottom }),
    async () => await execa('hlb', ['run', '--target=build', 'changeset.hlb'], { cwd: middle }),
    async () => await execa('hlb', ['run', '--target=build', 'changeset.hlb'], { cwd: top })
  ])
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

test('should build image', async t => {
  t.timeout(20 * 1000)
  const commit = mockCommit()
  await promisify(hlb.build)(commit)
  await execa('docker', ['pull', commit.artifactName])
  const format = '{{json .Config.Labels}}'
  const result = (await execa(
    'docker', ['inspect', `--format=${format}`, commit.artifactName]
  )).stdout

  t.regex(result, /^\{.*\}$/)
  t.deepEqual(JSON.parse(result), {
    bottom: '3.1415',
    middle: '2.7182',
    top: '6.6261'
  })
})

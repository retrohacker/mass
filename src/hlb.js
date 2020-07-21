const { spawn } = require('child_process')
const path = require('path')
const parseImage = require('parse-docker-image-name')
const tempy = require('tempy')
const neo = require('neo-async')
const fs = require('fs')

// Detect the types of artifacts used and include any dependent hlb modules
const artifactDeps = (changesets, artifactName) => {
  let result = ''

  // For any image that isn't fully qualified, use the titus registry to
  // resolve them. This lets us do integration tests against local regisitries.
  const needsTitus =
    changesets.reduce((a, v) => a || parseImage(v.image).hostname === undefined, false) ||
    parseImage(artifactName).hostname === undefined
  if (needsTitus) {
    result += 'import titus from fs { image "dockerregistry.test.netflix.net:7002/mart/titus.hlb"; }'
  }

  return result
}

// Today we support Titus artifacts and standard Docker artifacts, the only
// difference being whether we let the docker daemon resolve the image string
// or the titus hlb module
const importArtifact = ({ name, image }) =>
  parseImage(image).hostname === undefined
    ? `import ${name} from fs { titus.registryImage "${image}"; }`
    : `import ${name} from fs { image "${image}"; }`

const push = (artifactName) =>
  parseImage(artifactName).hostname === undefined
    ? `titus.registryPush "${artifactName}"`
    : `dockerPush "${artifactName}"`

const generateStake = ({ name }) => `${name}.stake`

// {
//   artifactName: "foobar",
//   changesets: [
//     {
//       "name": "fizzbuzz",
//       "image": "myimage"
//     }
//   ]
// }
const generateHlb = (commit) => `
${artifactDeps(commit.changesets, commit.artifactName)}
${commit.changesets.map(importArtifact).join('\n')}

fs build() {
${commit.changesets.map(generateStake).map(v => `  ${v}`).join('\n')}
}

fs publish() {
  build
  ${push(commit.artifactName)}
}
`.trim()

/* Given a commit object, build and return a docker image using hlb */
function build (commit, cb) {
  const hlb = generateHlb(commit)
  const tmpdir = tempy.directory({ prefix: 'mass' })
  const build = path.join(tmpdir, 'build.hlb')
  const output = path.join(tmpdir, 'output')
  const fail = (err) => {
    err.tmpdir = tmpdir
    return cb(err)
  }
  neo.parallel({
    build: (cb) => fs.writeFile(build, hlb, 'utf8', cb),
    output: (cb) => fs.open(output, 'a', cb)
  }, (err, files) => {
    if (err) return fail(err)
    let once = 0 // Dedupe invocations of done
    const done = (err, code) => {
      if (once++ > 0) return undefined
      if (err) return fail(err)
      if (code !== 0) return fail(new Error(`hlb returned status code: ${code}`))
      return cb()
    }
    spawn('hlb', ['run', '--log-output=plain', '--target=publish', 'build.hlb'], {
      cwd: tmpdir,
      stdio: ['ignore', files.output, files.output]
    }).on('error', (err) => done(err))
      .on('close', (code) => done(null, code))
  })
}

module.exports = { generateHlb, build }

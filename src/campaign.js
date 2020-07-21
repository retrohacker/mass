/* campaign.js contains an idempotent loop that:
 *  + For every repository with open pull requests, select the oldest open PR
 *  + Generate a new commit applying the pull request to the head of the repo
 *  + Builds an image for the commit using hlb
 * It does all of this in a transaction to protect against racing with other
 * copies of ourselves.
 */
const neo = require('neo-async')
const sql = require('./sql')
const genDigest = require('./digest')

let running = false
let rerun = false

// Keep track of where we have been invoked with a callback that expects to be
// called after a complete run of a campaign. For every invocation that happens
// while campaign is already running, we queue it up in the next array. When a
// campaign ends, we set current to next and set next to an empty array. We do
// this so that a route can call campaign and, when the callback is invoked, it
// knows a complete campaign has been run. If we only kept a single array of
// callbacks, anything that called campaign while it was already running risks
// having it's callback invoked before the state it set in the database had
// been considered in a campaign.
const callbacks = {
  current: [],
  next: []
}

// This function is responsible for ensuring only one invocation of campaign
// is running in our process at a time. Since it is idempotent and contextless,
// it will queue at most one additional run of itself up, from then on it will
// ignore all future invocations.
function shouldRun (cb) {
  if (running) {
    // Make sure the function will re-invoke itself once done and invoke our
    // callback, if provided, after it completes an entire campaign
    if (cb) callbacks.next.push(cb)
    rerun = true
    // Dedupe this invocation
    return false
  }
  // Set ourselves to running and make sure our callback will be invoked when
  // the campaign finishes
  running = true

  // Keep ourselves from looping indefinitely
  rerun = false

  // If we were given a callback, invoke it when we are done
  if (cb) callbacks.current.push(cb)
  return true
}

/* generateCommit takes a pull requests and converts it to a commit object.
 * It generates the new commit by updating the dependency tree of the current
 * repository's head with the new changeset, then it does a mark/sweep to
 * shake out any dependencies that have been removed from the tree.
 * Returns:
 * {
 *   repository: STRING,
 *   changeset: STRING,
 *   digest: STRING,
 *   parent: STRING,
 *   changesets: [ STRING ]
 * }
 */
function generateCommit (client, log, pr, cb) {
  log.info({ pr }, 'converting PR to commit')
  neo.parallel({
    current: (cb) => client.query(sql.select.treeRepo, [pr.repository], (err, res) => cb(err, res)),
    target: (cb) => client.query(sql.select.changeset, [pr.changeset], (err, res) => cb(err, res)),
    latest: (cb) => client.query(sql.select.changesetDeps, [pr.changeset], (err, res) => cb(err, res)),
    repo: (cb) => client.query(sql.select.repository, [pr.repository], (err, res) => cb(err, res))
  }, (err, res) => {
    if (err) { return cb(err) }

    // Now we have the list of changesets (and their stakeholders) for the
    // current commit along with our target changeset to apply.
    const current = res.current.rows
    const target = res.target.rows[0]
    const repo = res.repo.rows[0]
    const latest = new Map()
    res.latest.rows.forEach(v => latest.set(v.name, v))

    log.info({ current, target }, 'beginning mark and sweep')

    // The entrypoint to our tree is the changeset that shares a name with our
    // repository
    const entrypoint = pr.repository

    // Mark all the nodes as not visited
    current.forEach(v => { v.visited = false })

    // Index all the nodes of our dependency tree to prepare for mark and sweep
    const nodes = new Map()
    current.forEach(v => nodes.set(v.name, v))

    // Update the dependency tree w/ our proposed PR
    nodes.set(target.name, target)

    // For any new dependencies our commit introduces, include them in the
    // flattened dependency tree
    target.stakeholders
      .filter(v => !nodes.has(v))
      .forEach(v => { nodes.set(v, latest.get(v)) })

    ;(function mark (name) {
      const node = nodes.get(name)
      if (!node) return undefined
      node.visited = true
      if (node.visted) return undefined
      log.info({ node })
      node.stakeholders.forEach(mark)
    })(entrypoint)
    log.info({ entrypoint, map: Object.fromEntries(nodes) }, 'finished marking')

    // Sweep
    const result = Array.from(nodes.values()).filter(v => v.visited)
    result.forEach(v => delete v.visited)
    log.info({ result }, 'finished sweep')

    // TODO: test for dropping and adding dependencies

    const changesets = result.map(v => v.uuid)

    // Generate commit
    const commit = {
      repository: pr.repository,
      changeset: pr.changeset,
      parent: repo.head,
      digest: genDigest(repo.head, changesets),
      changesets
    }

    log.info({ commit }, 'generated commit')

    return cb(err, commit)
  })
}

module.exports = function campaign (pool, log, cb) {
  log.info({ running, rerun, callback: cb !== undefined }, 'invoked campaign driver')

  // Check to see if we should run
  if (!shouldRun(cb)) {
    log.info('campaign driver already running')
    // If not abort
    return undefined
  }

  // We are the only copy of ourselves running now

  // Kick off our transaction
  const state = { log, transaction: false }
  neo.waterfall([
    (cb) => {
      // Checkout a client from the database connection pool for handling a
      // transaction
      pool.connect((err, client, done) => cb(err, client, done))
    },
    (client, done, cb) => {
      // Store the client and release callback on our state object so we can
      // clean it up at the end of all our async work
      state.client = client
      state.done = done
      // Begin our transaction
      state.client.query('BEGIN', err => cb(err))
    },
    (cb) => {
      // Keep track of whether we've committed our transaction so our cleanup
      // handler can rollback on an error if needed
      state.transaction = true
      cb()
    },
    (cb) => {
      // First grab all of the PRs for repositories that don't already have
      // a candidate image pending
      state.client.query(sql.select.prsForCampaign, (err, res) => cb(err, res))
    },
    (res, cb) => {
      state.prs = res.rows
      log.info({ prs: state.prs }, 'fetched prs ready for campaign')
      // Next convert all of the PRs into commit objects
      neo.map(res.rows, generateCommit.bind(null, state.client, log), cb)
    },
    (commits, cb) => {
      state.commits = commits

      // Insert our commits into the database
      neo.each(state.commits, (commit, cb) => {
        state.client.query(sql.insert.commit, [
          commit.parent,
          commit.digest,
          commit.changesets
        ], err => cb(err))
      }, err => cb(err))
    },
    // TODO: generate HLB, build image, and update commit w/ image
    (cb) => {
      log.info('generated commits')
      // Update our repository heads to point to the new commits
      neo.each(state.commits, (commit, cb) => {
        state.client.query(sql.update.repositoryHead, [
          commit.repository,
          commit.digest
        ], err => cb(err))
      }, err => cb(err))
    },
    (cb) => {
      // Add commits to pull request
      neo.each(state.commits, (commit, cb) => {
        state.client.query(sql.update.pullrequestCommit, [
          commit.repository,
          commit.changeset,
          commit.digest
        ], err => cb(err))
      }, err => cb(err))
    },
    (cb) => {
      log.info('updated repository heads')
      // Mark the campaigns as merged
      neo.each(state.prs, (pr, cb) => {
        state.client.query(sql.update.pullrequestStatus, [
          pr.repository,
          pr.changeset,
          'merged'
        ], err => cb(err))
      }, err => cb(err))
    },
    (cb) => {
      log.info('marked campaigns as merged')
      // commit the transaction
      state.client.query('COMMIT', err => cb(err))
    },
    (cb) => {
      log.info('committed transaction')
      // Finally, keep our cleanup task from trying to rollback our transaction
      state.transaction = false
      cb()
    }
  ], err => {
    // Cleanup any state we created during the campaign
    return done(state, () => {
      // If we encountered an error above, we retry the campaign.
      if (err) {
        log.error({ err }, 'failed to run campaign, retrying')
        rerun = true
      } else {
        // If we didn't encounter an error we invoke each of our callbacks
        callbacks.current.forEach(cb => cb())
      }

      // If we are rerunning because of an error, this means all the callbacks
      // in next can be called if the next campaign succeeds.  Likewise all the
      // current callbacks will need to be called at that point as well. So we
      // merge the arrays if we saw an error. If we are rerunning without an
      // error it means all our current callbacks have been invoked above.
      // If we aren't rerunning then clear our callback array.
      if (rerun && err) {
        callbacks.current = callbacks.current.concat(callbacks.next)
      } else if (rerun) {
        callbacks.current = callbacks.next
      } else {
        callbacks.current = []
      }

      // Next should always start fresh
      callbacks.next = []

      // Relase the mutex and, if rerun is true, kick off another campaign
      running = false

      if (rerun) {
        return campaign(pool, log)
      }
    })
  })
}

// This function handles cleaning up any state created during a campaign
// transaction, it should be called before releasing the mutex
function done (state, cb) {
  neo.waterfall([
    (cb) => {
      // If we didn't complete the transaction, try to roll it back. If the
      // rollback fails (i.e. lost connection to DB) we log and ignore the
      // error then continue on with tearing down the connection
      if (state.client === undefined || state.transaction === false) {
        return cb()
      }
      state.client.query('ROLLBACK', err => {
        if (err) {
          state.log.error({ err }, 'failed to rollback transaction')
        }
        cb()
      })
    },
    (cb) => {
      // If we have a database client checked out from our pool, release it back
      if (state.done) {
        state.done()
      }
      return cb()
    }
  ], cb)
}

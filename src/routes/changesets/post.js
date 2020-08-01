const errors = require('restify-errors')
const sql = require('../../sql')
const neo = require('neo-async')
const campaign = require('../../campaign')

module.exports = ({ pool, log }) => (request, response, next) => {
  request.log.info({ body: request.body }, 'got request')

  if (request.body === undefined) {
    return next(new errors.BadRequestError('Expected JSON post body'))
  }

  const { name, image, stakeholders } = request.body

  // First validate our payload
  if (name === undefined) {
    return next(new errors.BadRequestError('name is a required field'))
  }
  if ((typeof name) !== 'string') {
    return next(new errors.BadRequestError('name must be a string'))
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    return next(new errors.BadRequestError('name must match /[a-zA-Z][a-zA-Z0-9_-]*/'))
  }
  if (image === undefined) {
    return next(new errors.BadRequestError('image is a required field'))
  }
  if ((typeof image) !== 'string') {
    return next(new errors.BadRequestError('image must be a string'))
  }
  if (stakeholders === undefined) {
    return next(new errors.BadRequestError('stakeholders is a required field'))
  }
  if (!Array.isArray(stakeholders)) {
    return next(new errors.BadRequestError('stakeholders must be an array'))
  }
  if (!stakeholders.reduce((a, v) => a && (typeof (v) === 'string'), true)) {
    return next(new errors.BadRequestError('stakeholders must be an array of strings'))
  }

  request.log.info({ image, name, stakeholders }, 'creating changeset')
  const result = {}
  neo.waterfall([
    (cb) => {
      // First we generate the changeset
      pool.query(sql.insert.changeset, [name, image, stakeholders], cb)
    },
    (res, cb) => {
      // Store the returned changeset UUID so we can send it back to the client
      // later
      result.uuid = res.rows[0].uuid
      cb()
    },
    (cb) => {
      // Get all of the repositories that have this changeset in their
      // dependency tree
      pool.query(sql.select.repositoriesByChangeset, [name], cb)
    },
    (repos, cb) => {
      // Send the list of pull requests we are opening back to the client
      result['pull-requests'] = repos.rows.map(v => v.name)

      request.log.info({ prs: result['pull-requests'] }, 'opening pull requests')

      // Generate pull requests against those repositories
      neo.each(
        result['pull-requests'],
        (repo, cb) => pool.query(sql.insert.pullrequest, [result.uuid, repo], cb),
        cb)
    }
  ], (err) => {
    if (err) {
      request.log.error({ err })
      return next(new errors.InternalServerError(`${request.id}`))
    }
    // Kick off the change campaign
    campaign(pool, log)
    response.header('content-type', 'application/json')
    response.status(201)
    response.send(result)
    next()
  })
}

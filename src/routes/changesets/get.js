const log = require('../../log')
const neo = require('neo-async')
const sql = require('../../sql')

module.exports = (pool) => (request, response, next) => {
  log.info({ query: request.query }, 'got request')
  const { name } = request.query

  let client, done, result
  neo.waterfall([
    (cb) => pool.connect(cb),
    (c, d, cb) => {
      client = c
      done = d
      log.info('query')
      if (name) {
        client.query(sql.select.changesetsByName, [name], cb)
      } else {
        client.query(sql.select.changesets, cb)
      }
    },
    (res, cb) => {
      if (name) {
        const changesets = new Map()
        for (let i = 0; i < res.rows.length; i++) {
          const row = res.rows[i]
          if (!changesets.has(row.uuid)) {
            changesets.set(row.uuid, {
              uuid: row.uuid,
              created: row.created,
              name: row.name,
              image: row.image,
              stakeholders: [row.stakeholder]
            })
          } else {
            changesets.get(row.uuid).stakeholders.push(row.stakeholder)
          }
        }
        result = { changesets: Array.from(changesets.values()) }
      } else {
        result = { changesets: res.rows.map(v => v.name) }
      }
      cb()
    }
  ], err => {
    if (done) {
      done()
    }
    if (err) {
      log.error({ err })
      err.statusCode = 500
      return next(err)
    }
    response.header('content-type', 'application/json')
    response.status(201)
    response.send(result)
    next()
  })
}

const sql = require('../../sql')

module.exports = ({ pool }) => (request, response, next) => {
  request.log.info({ query: request.query }, 'got request')
  const { name } = request.query

  // This endpoint accepts two forms:
  //   * returning all changesets
  //   * fetching all changesets by name
  // This next block picks which query to run based on whether or not we
  // received a query string from the user. For the first case we only return
  // the unique names we know of to reduce the amount of data being sent over
  // the wire.
  let query, args
  if (name) {
    query = sql.select.changesetsByName
    args = [name]
  } else {
    query = sql.select.changesets
    args = []
  }
  pool.query(query, args, (err, res) => {
    // If we got an error back from the database, generate a 500 and abort the
    // request.
    if (err) {
      request.log.error({ err })
      err.statusCode = 500
      return next(err)
    }

    response.header('content-type', 'application/json')
    response.status(201)
    // Format the result based on the same logic as above
    // Note: Instead of just returning res.rows, we add it as the value of the
    // changesets key because a valid application/json payload can't have an
    // array as the top level object.
    if (name) {
      response.send({ changesets: res.rows })
    } else {
      response.send({ changesets: res.rows.map(v => v.name) })
    }
    next()
  })
}

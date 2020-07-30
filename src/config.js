/* Attempts to load a global configuration from /etc/mass.json
 * otherwise it uses the default that ships with the project */
const log = require('./log')

const PATH = '/etc/mass.json'

log.info('fetching configuration', { path: PATH })

try {
  // require will throw if there isn't a config file at /etc/mass.json or if
  // it is malformed, we catch the exception and fallback to using the local
  // config file
  module.exports = require(PATH)
  log.info({ path: PATH, config: module.exports }, 'fetched config')
} catch (e) {
  log.info({ path: PATH, err: e }, 'failed to load config, using default')
  module.exports = require('../config.json')
}

// Process any environment variables set
if (process.env.MASS_DB_HOST) {
  log.info('detect MASS_DB_HOST envvar')
  module.exports.db.host = process.env.MASS_DB_HOST
}
if (process.env.MASS_DB_PORT) {
  log.info('detect MASS_DB_PORT envvar')
  module.exports.db.port = process.env.MASS_DB_PORT
}

log.info({ config: module.exports }, 'server starting with config')

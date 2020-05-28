/* Attempts to load a global configuration from /etc/mass.json
 * otherwise it uses the default that ships with the project */
const log = require('./log')

const PATH = '/etc/mass.json'

log.info('fetching configuration', { path: PATH })

try {
  module.exports = require(PATH)
  log.info({ path: PATH, config: module.exports }, 'fetched config')
} catch (e) {
  log.info({ path: PATH, err: e }, 'failed to load config, using default')
  module.exports = require('../config.json')
}

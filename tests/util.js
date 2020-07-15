const port = require('get-port')
const { promisify } = require('util')
const main = promisify(require('../src/index.js'))

// Single shared config for all servers. Tests that want to test configuration
// settings must stand up their own dedicated server instance.
const getConfig = () => ({
  server: {
    listen: [0, '0.0.0.0']
  },
  db: {
    user: 'mart',
    host: 'localhost',
    database: 'mass',
    port: 26257
  },
  log: {
    name: 'mass',
    level: 'silent'
  }
})

// Get a copy of the server's config, startup up the server if it doesn't
// already exists
const getServer = async () => {
  const config = getConfig()

  // Grab an available port
  config.server.listen[0] = await port()

  // Start the server
  const server = await main(config)

  // Return our config
  return { config, server }
}

module.exports = { getServer }

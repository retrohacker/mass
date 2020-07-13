const port = require('get-port')
const { promisify } = require('util')
const server = promisify(require('../src/index.js'))

// Some helper functions for running tests

// SERVER SINGLETON
// Since we support running multiple tests at once, we have created the notion
// of a server singleton. This singleton garbage collects itself by keeping
// track of how many active references are using it. When the reference count
// reaches zero, it tears itself down.  running and only shuts down when the
// test count reaches 0. The first invocation will create a server object. From
// then on out, every subsequent invocation will get that same server object
// back. We protect against race conditions by queuing up callbacks on init.
// For shutdown we do it in the background to avoid deadlocking tests.
let SERVER // Server singleton
let REFERENCES = 0 // Number of tests actively using a server
let PROMISES = [] // Promises queue for when the server is starting up
let STARTING = false // Whether to queue callbacks

// Single shared config for all servers. Tests that want to test configuration
// settings must stand up their own dedicated server instance.
const CONFIG = {
  server: {
    listen: [0, '0.0.0.0']
  },
  db: {
    user: 'mart',
    host: 'localhost',
    database: 'mass',
    port: 26257
  }
}

// Get a copy of the server's config, startup up the server if it doesn't
// already exists
const getServer = async () => {
  // Increment our reference counter
  REFERENCES++

  // If the server is already up, go ahead and return the config object used
  // to create it
  if (SERVER !== undefined) return CONFIG

  // If another test already kicked off server initialization, wait for that
  // to complete and then return the config object used to create it
  if (STARTING === true) {
    await new Promise((resolve) => PROMISES.push(resolve))
    return CONFIG
  }

  // Otherwise we are the first one through the door, go ahead and kick off
  // the server initialization
  STARTING = true

  // Grab an available port
  CONFIG.server.listen[0] = await port()

  // Startup the server
  SERVER = await server(CONFIG)

  // Release our mutex
  STARTING = false

  // Resolve all the other promises waiting for a reference
  PROMISES.forEach(promise => promise.resolve())
  PROMISES = []

  // Return our config
  return CONFIG
}

// Relase our reference for the server, allowing it to be garbage collected if
// there are no other references
const releaseServer = async () => {
  // Decrement our reference counter
  REFERENCES--

  // If there are still other active references we dont need to garbage collect
  if (REFERENCES !== 0) return undefined

  // Garbage collect the server
  await promisify(SERVER.close)
}

module.exports = {
  getServer,
  releaseServer
}

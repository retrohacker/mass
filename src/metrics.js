const spectator = require('nflx-spectator')
const NodeMetrics = require('nflx-spectator-nodejsmetrics')
const getSpectatorConfig = require('nflx-spectator-jsconf')

module.exports = function init ({ server, log }) {
  const registry = new spectator.Registry(getSpectatorConfig())
  registry.logger = log
  registry.start()
  const metrics = new NodeMetrics(registry)
  metrics.start()

  const incoming = registry.counter('server.incomingRequest')
  const latency = registry.timer('server.requestLatency')
  const requests = registry.createId('server.requestCount')
  server.use((request, response, next) => {
    incoming.increment()
    request.set('latency', registry.hrtime())
    next()
  })
  server.on('after', (request, response) => {
    registry.counter(requests.withTags({
      path: request.getRoute().path.toString(),
      status: response.statusCode
    })).increment()
    latency.record(registry.hrtime(request.get('latency')))
  })
  return { atlas: registry, nodeMetrics: metrics }
}

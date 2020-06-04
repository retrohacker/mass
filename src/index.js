const db = require('./db');
const log = require("./log");
const restify = require("restify");

module.exports = function init(config, cb) {
  const server = restify.createServer({
    log
  });

  server.use(restify.plugins.bodyParser())
  server.post('/changesets', require("./routes/changesets/post.js"));

  db.init(() => {
    log.info({ config: config.server }, "starting server")
    server.listen(...config.server.listen, () => {
      log.info({ config: config.server }, "server up");
      if(cb) return cb(undefined, server);
    })
  })
}

if (require.main === module) {
  init(require('./config.js'));
}

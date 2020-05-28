const db = require('./db')

// Just here to test for now
db.init(() => {
  db.pool.query('SHOW TABLES;', (_, result) => {
    console.log(result.rows)
    db.shutdown()
  })
})

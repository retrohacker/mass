const db = require('./db')

db.init(() => {
  db.pool.query('SHOW TABLES;', (_, result) => {
    console.log(result.rows)
    db.shutdown()
  })
})

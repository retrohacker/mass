CREATE TABLE IF NOT EXISTS changesets (
  digest STRING PRIMARY KEY,
  name STRING,
  image STRING,
  created TIMESTAMPTZ NOT NULL DEFAULT current_timestamp()
);

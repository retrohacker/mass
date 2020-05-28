CREATE TABLE IF NOT EXISTS changesets (
  digest STRING PRIMARY KEY,
  name STRING,
  created TIMESTAMPTZ NOT NULL DEFAULT current_timestamp()
);

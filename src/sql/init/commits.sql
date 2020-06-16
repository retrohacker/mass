CREATE TABLE IF NOT EXISTS commits (
  digest STRING PRIMARY KEY,
  parent STRING,
  root STRING,
  created TIMESTAMPTZ NOT NULL DEFAULT current_timestamp()
);

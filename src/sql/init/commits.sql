CREATE TABLE IF NOT EXISTS commits (
  digest STRING PRIMARY KEY,
  parent STRING,
  changesets STRING ARRAY,
  created TIMESTAMPTZ NOT NULL DEFAULT current_timestamp()
);

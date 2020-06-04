CREATE TABLE IF NOT EXISTS changesets (
  name STRING,
  image STRING,
  id INT PRIMARY KEY DEFAULT unique_rowid(),
  created TIMESTAMPTZ NOT NULL DEFAULT current_timestamp()
);

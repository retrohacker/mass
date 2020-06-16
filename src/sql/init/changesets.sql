CREATE TABLE IF NOT EXISTS changesets (
  name STRING,
  image STRING,
  uuid BYTES DEFAULT uuid_v4(),
  id INT PRIMARY KEY DEFAULT unique_rowid(),
  created TIMESTAMPTZ NOT NULL DEFAULT current_timestamp()
);

CREATE TABLE IF NOT EXISTS changesets (
  name STRING,
  image STRING,
  uuid BYTES DEFAULT uuid_v4(),
  created TIMESTAMPTZ NOT NULL DEFAULT current_timestamp()
);

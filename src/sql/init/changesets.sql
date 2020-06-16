CREATE TABLE IF NOT EXISTS changesets (
  name STRING,
  image STRING,
  uuid BYTES DEFAULT uuid_v4(),
  stakeholders STRING ARRAY,
  created TIMESTAMPTZ NOT NULL DEFAULT current_timestamp()
);

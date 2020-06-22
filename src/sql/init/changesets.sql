CREATE TABLE IF NOT EXISTS changesets (
  name STRING,
  image STRING,
  uuid STRING DEFAULT from_uuid(uuid_v4()),
  stakeholders STRING ARRAY,
  created TIMESTAMPTZ NOT NULL DEFAULT current_timestamp()
);

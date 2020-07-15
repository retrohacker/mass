CREATE TABLE IF NOT EXISTS pullrequests (
  changeset STRING,
  repository STRING,
  commit STRING,
  status STRING DEFAULT 'open',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (changeset, repository),
  INDEX (changeset, repository, status)
);

CREATE TABLE IF NOT EXISTS commit_changesets (
  digest STRING,
  changeset STRING,
  PRIMARY KEY (digest, changeset)
);

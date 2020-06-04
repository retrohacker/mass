CREATE TABLE IF NOT EXISTS changeset_stakeholders (
  digest STRING,
  stakeholder STRING,
  PRIMARY KEY (digest, stakeholder)
);

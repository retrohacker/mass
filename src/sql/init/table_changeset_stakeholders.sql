CREATE TABLE IF NOT EXISTS changeset_stakeholders (
  changeset STRING,
  stakeholder STRING,
  PRIMARY KEY (changeset, stakeholder)
);

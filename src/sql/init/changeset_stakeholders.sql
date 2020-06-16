CREATE TABLE IF NOT EXISTS changeset_stakeholders (
  changeset INT,
  stakeholder STRING,
  PRIMARY KEY (changeset, stakeholder)
);

INSERT INTO changesets(name, image, stakeholders)
VALUES($1, $2, $3)
RETURNING uuid

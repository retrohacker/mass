INSERT INTO repositories(name, artifactName, head)
VALUES($1, $2, $3)
RETURNING *

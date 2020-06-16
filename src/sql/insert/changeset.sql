INSERT INTO changesets(name, image)
VALUES($1, $2)
RETURNING *

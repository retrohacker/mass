INSERT INTO commits(parent, digest, changesets)
VALUES($1, $2, $3)
RETURNING digest

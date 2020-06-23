INSERT INTO repositories(name, head)
VALUES($1, $2)
RETURNING *

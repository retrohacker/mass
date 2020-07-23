SELECT *
FROM repositories
WHERE name = $1 OR artifactName = $2
LIMIT 1

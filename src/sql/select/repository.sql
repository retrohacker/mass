SELECT name, artifactName, head
FROM repositories
WHERE name=$1

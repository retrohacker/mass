SELECT name, image, uuid, stakeholders, created
FROM changesets
WHERE name = $1
ORDER BY CREATED
LIMIT 1

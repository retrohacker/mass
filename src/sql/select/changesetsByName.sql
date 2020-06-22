SELECT image, name, stakeholders, uuid, created
FROM changesets
WHERE name=$1
ORDER BY created

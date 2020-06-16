SELECT image, name, stakeholders, from_uuid(uuid) AS uuid, created
FROM changesets
WHERE name=$1
ORDER BY created

SELECT name, image, stakeholders
FROM changesets
WHERE from_uuid(uuid)=$1

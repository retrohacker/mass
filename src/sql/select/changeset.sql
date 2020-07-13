SELECT name, image, uuid, stakeholders, created
FROM changesets
WHERE uuid=$1

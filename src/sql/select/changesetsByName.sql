SELECT image, name, stakeholder, from_uuid(uuid) AS uuid, created
FROM changesets, changeset_stakeholders
WHERE changesets.name=$1 AND changesets.id=changeset_stakeholders.changeset
ORDER BY changesets.created

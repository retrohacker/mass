SELECT name, image, stakeholder
FROM changesets, changeset_stakeholders
WHERE from_uuid(changesets.uuid)=$1 AND changesets.id=changeset_stakeholders.changeset

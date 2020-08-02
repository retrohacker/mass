WITH RECURSIVE get_deps(name, uuid, image, stakeholders, created) AS (
  (
    SELECT DISTINCT ON (name) name, uuid, image, stakeholders, created
    FROM changesets
    WHERE uuid = $1
  )
  UNION ALL
  (
    SELECT DISTINCT ON (c.name) c.name, c.uuid, c.image, c.stakeholders, c.created
    FROM changesets c, get_deps d
    WHERE c.name = ANY(d.stakeholders)
    ORDER BY name, created DESC
  )
)
SELECT DISTINCT ON (name) name, uuid, image, stakeholders
FROM get_deps

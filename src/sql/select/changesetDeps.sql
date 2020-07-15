WITH RECURSIVE get_deps(name, uuid, stakeholders, created) AS (
  (
    SELECT DISTINCT ON (name) name, uuid, stakeholders, created
    FROM changesets
    WHERE uuid = $1
    ORDER BY name, created
  )
  UNION ALL
    SELECT c.name, c.uuid, c.stakeholders, c.created
    FROM changesets c, get_deps d
    WHERE c.name = ANY(d.stakeholders)
)
SELECT DISTINCT ON (name) name, uuid, stakeholders
FROM get_deps
ORDER BY name, created

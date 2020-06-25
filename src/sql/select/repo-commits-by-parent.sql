WITH RECURSIVE get_commits(digest, parent, created, tree, cycle) AS (
  (
    SELECT digest, parent, created, ARRAY[digest], false
    FROM commits
    WHERE digest = $1
  )
  UNION ALL
    SELECT c.digest, c.parent, c.created, cr.tree || c.digest, c.digest = ANY(cr.tree)
    FROM commits c, get_commits cr
    WHERE c.digest = cr.parent AND NOT cycle
)
SELECT digest, parent, created
FROM get_commits
LIMIT 100

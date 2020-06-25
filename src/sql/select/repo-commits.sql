WITH RECURSIVE get_commits(digest, parent, created) AS (
  (
    SELECT head AS digest, parent, c.created as created
    FROM repositories r, commits c
    WHERE r.head = c.digest AND r.name = $1
  )
  UNION ALL
    SELECT c.digest, c.parent, c.created
    FROM commits c, get_commits cr
    WHERE c.digest = cr.parent
)
SELECT digest, parent, created
FROM get_commits
LIMIT 100

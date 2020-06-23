WITH RECURSIVE get_commits(digest, parent) AS (
  (
    SELECT head AS digest, parent
    FROM repositories r, commits c
    WHERE r.head = c.digest AND r.name = $1
  )
  UNION ALL
    SELECT c.digest, c.parent
    FROM commits c, get_commits cr
    WHERE c.digest = cr.parent
)
SELECT digest, parent
FROM get_commits

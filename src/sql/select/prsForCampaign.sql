WITH ready AS (
  SELECT DISTINCT on (repository) repository, changeset, status, timestamp
  FROM pullrequests
  WHERE status = 'open' OR status = 'candidate'
  ORDER BY repository, timestamp
)
SELECT DISTINCT on (repository) repository, changeset
FROM ready
WHERE status = 'open'
ORDER BY repository, timestamp

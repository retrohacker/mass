SELECT *
FROM pullrequests
WHERE changeset=$1
ORDER BY timestamp

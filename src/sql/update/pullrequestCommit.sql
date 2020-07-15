UPDATE pullrequests
SET commit = $3
WHERE repository = $1 AND changeset = $2

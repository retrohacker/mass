UPDATE pullrequests
SET status = $3
WHERE repository = $1 AND changeset = $2

SELECT digest, parent
FROM commits
WHERE digest = $1

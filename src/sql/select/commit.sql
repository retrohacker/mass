SELECT digest, parent, changesets, created
FROM commits
WHERE digest = $1

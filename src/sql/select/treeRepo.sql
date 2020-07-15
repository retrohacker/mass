-- Get the flattened tree of dependencies for the current HEAD of a repository
SELECT changesets.name, changesets.uuid, changesets.stakeholders
FROM repositories, commits, UNNEST(commits.changesets) AS changeset, changesets
WHERE repositories.name = $1 AND repositories.head = commits.digest AND changeset = changesets.uuid

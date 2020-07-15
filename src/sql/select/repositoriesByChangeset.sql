SELECT DISTINCT r.name
FROM repositories r, commits c, changesets cs,
  UNNEST(c.changesets) as changeset
WHERE r.head = c.digest AND changeset = cs.uuid AND cs.name = $1

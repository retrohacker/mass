# MASS

The Managed Artifact Stake Service

> Open By Default: Still a early work in progress

## Local Dev

You need to have node, npm, and docker installed.

* [install node](https://www.npmjs.com/package/n)
* [install docker](https://docs.docker.com/engine/install/)

Then open a terminal and run `npm run infra`. This will create all the infrastructure pieces necessary to run using docker.

Then you can run `npm run start` to get a local copy of the server running for development.

## Deploying

You need an SQL database such as cockroachdb or postgres.

You can configure how MASS connects to your database by copying-and-pasting this json object to `/etc/mass.json` on the computer you are deploying to:

```json
{
  "db": {
    "user": "mart",
    "host": "localhost",
    "database": "mass",
    "port": 26257
  }
}
```

Change any values you need, the `db` object is passed directly to `pg.pool` as it's [config object](https://node-postgres.com/api/pool#constructor).

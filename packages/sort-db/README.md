# sort-db
Postgres database migrations

## Usage

### Local development

Apps which use this package must include their own [docker compose][]
file which depends on the public postgres container and which mounts this
package as the postgres entrypoint directory ([example][compose example]). When
the postgres docker container starts up it will execute [init.sh][] in this
repository which then runs all migrations/ scripts in filename order.

[init.sh]: https://github.com/sortxyz/sort-db/blob/main/init.sh

### Staging and production

AWS staging and production migrations are manual. You'll need to connect to RDS
postgres using pgadmin as described in the [runbook][] and then execute each
migration manually, for each schema. Take note, many migrations are designed to
be run on multiple schemas (see [multi-schema updates](#multi-schema-updates)
below).

[runbook]: https://www.notion.so/sortxyz/Infra-Runbook-4d797b63fb054959aec08e0897aeafde

## How to write a migration

### Order

Migration files are executed in filename order. When naming a new migration file, start its name with
a number larger than any previous file to ensure it executes after the others.

For example, a migration file named `013-multi_schema-create-abi-table.sql` will be executed after `012-hello-world.sql`.

### Multi-schema updates

For migration scripts which are designed to run on all blockchain schemas,
include `-multi_schema-` in the file name.  This tells the init script to run
the migration on all configured schemas (today that's `ethereum`, `polygon` and
`goerli`).  All other files will only be run on the `public` schema by default
but the script can always override this with the `set search_path` SQL
statement.

For example, a migration file named `013-multi_schema-create-abi-table.sql` will
be executed three times, once per supported schema while a migration file named
`012-hello-world.sql` will be executed once on the `public` schema.

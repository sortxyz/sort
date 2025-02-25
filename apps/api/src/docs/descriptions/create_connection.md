Creates a database Connection.

A database Connection is a set of credentials and server information used by Sort to connect to your database. All data access in Sort is facilitated through database Connections you add to your Organization. Once added, all Organization members can query the databases accessible through the Connection.

📘 _NOTE: When you add a Connection, Sort imports metadata like the names of your databases, schemas, tables and columns - but not any data._

### Supported database platforms:

- Snowflake
- Postgres

See also [Connection Overview](https://docs.sort.xyz/docs/database-connections/database-connections)

### Example

To create a Connection to a Neon Postgres database that is only accessible to your Sort Organization:

```bash
curl --request POST \
     --url https://api.sort.xyz/v2/orgs/ORG_SLUG/connections \
     --header 'accept: application/json' \
     --header 'content-type: application/json' \
     --data '
{
  "data_provider": "postgres",
  "visibility": "private",
  "name": "Products",
  "read_only": false,
  "type": "connection_string",
  "connection_string": "postgres://username:password@ep-rand-cloud-12345.us-east-2.aws.neon.tech/products"
}
'
```

#### response

```json
{
  "type": "create_connection",
  "payload": {
    "connection": {
      "id": "12345f64-5717-4562-b3fc-2c963f66afa6",
      "name": "Products",
      "data_provider": "postgres",
      "created_at": "2024-09-09T16:11:40.616Z",
      "created_by": "user|1234",
      "with_ssl": true,
      "visibility": "private",
      "readonly_connection_id": null,
      "organization_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "warehouse": null
    }
  }
}
```

Once this is created, if you also want to enable your Organization to run read-only SQL queries, you'll create a new Connection, setting `parent_connection_id` to the `id` of the first Connection and `read_only` to `true`. Everything else can be the same.

```bash
curl --request POST \
     --url https://api.sort.xyz/v2/orgs/ORG_SLUG/connections \
     --header 'accept: application/json' \
     --header 'content-type: application/json' \
     --data '
{
  "parent_connection_id": "12345f64-5717-4562-b3fc-2c963f66afa6", // the id of your first connection
  "read_only": true,
  "visibility": "private",
  "name": "Products",
  "data_provider": "postgres",
  "type": "connection_string",
  "connection_string": "postgres://username:password@ep-rand-cloud-12345.us-east-2.aws.neon.tech/products"
}
'
```

#### response

```json
{
  "type": "create_connection",
  "payload": {
    "connection": {
      "name": "string",
      "data_provider": "postgres",
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "organization_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "created_at": "2024-09-09T16:11:40.616Z",
      "created_by": "user|1234",
      "with_ssl": true,
      "visibility": "private",
      "readonly_connection_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "warehouse": "string"
    }
  }
}
```

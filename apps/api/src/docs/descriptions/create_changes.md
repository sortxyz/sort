Creates a batch of Changes for a Change Request.

A `Change` represents either an edit, delete or addition of a single database row.

There are three types of `Change`: `ADD`, `MODIFY` and `DELETE`. Which one you choose determines which additional fields you'll need to provide.

### `ADD`

An `ADD` defines a new row for a table.

### `MODIFY`

A `MODIFY` defines edits to one or more cells of a table row.

###  `DELETE`

A `DELETE` defines a row which to remove from a database table.

## Fields and Primary Keys

When adding or modifying a row, you'll declare the list of `column_name` / `value` pairs you want the row to contain. Let's look at a few examples.

_All examples operate on the following table._

| id (pk) | name | is_human |
| --- | --- | --- |
| 0 | Indiana Jones | true |
| 1 | Simba | true |
| 2 | Gollum | false |

First, we need to fix the `is_human` column for Simba, who is definitely not human. We'll define a `MODIFY` change as follows:

```js
{
  "schema_name": "movie",
  "table_name": "character",
  "action": "MODIFY",
  "fields": [
    {
      "column_name": "is_human",
      "value": false
    }
  ],
  "primary_keys": [
    {
      "column_name": "id",
      "value": 1
    }
  ]
}
```

Because we are modifying a single cell, we only need declare a single object in the `fields` array. If we were modifying multiple cells of the same row, we'd add additional objects to this array, one for each cell.

We also specify the row we are editing by declaring it's `primary_keys`. In this case, the primary key of the row is the `id` column and Simba's row id is `1`.

To include this `Change` in Change Request #1, you'd execute the following bash script:

```bash
curl --request POST \
  --url https://api.sort.xyz/v2/orgs/__ORG_SLUG__/databases/__DB_SLUG__/change-requests/1/changes/batch \
  --header 'Content-Type: application/json' \
  --header 'X-Api-Key: YOUR_TOKEN' \
  --data '[
  {
    "schema_name": "movie",
    "table_name": "character",
    "action": "MODIFY",
    "fields": [
      {
        "column_name": "is_human",
        "value": false
      }
    ],
    "primary_keys": [
      {
        "column_name": "id",
        "value": 1
      }
    ]
  }
]'
```

But wait, we also want to delete Gollum and add Harry Potter.

```bash
curl --request POST \
  --url https://api.sort.xyz/v2/orgs/__ORG_SLUG__/databases/__DB_SLUG__/change-requests/1/changes/batch \
  --header 'Content-Type: application/json' \
  --header 'X-Api-Key: YOUR_TOKEN' \
  --data '[
  {
    "schema_name": "movie",
    "table_name": "character",
    "action": "MODIFY",
    "fields": [
      {
        "column_name": "is_human",
        "value": false
      }
    ],
    "primary_keys": [
      {
        "column_name": "id",
        "value": 1
      }
    ]
  },
  {
    "schema_name": "movie",
    "table_name": "character",
    "action": "DELETE",
    "primary_keys": [
      {
        "column_name": "id",
        "value": 2
      }
    ]
  },
  {
    "schema_name": "movie",
    "table_name": "character",
    "action": "ADD",
    "fields": [
      {
        "column_name": "id",
        "value": 3
      }
      {
        "column_name": "name",
        "value": "Harry Potter"
      }
      {
        "column_name": "is_human",
        "value": true
      }
    ]
  }
]'
```

Notice that `DELETE` does not need declare any fields, only the primary key of the row to remove. Also note that `ADD` does not need declare any primary keys, only the fields of the row to add.

### Values

The `value` property of the `fields` and `primary_keys` objects support valid JSON values: number, string, null, boolean, objects and arrays. If the submitted value is invalid for the database column type, an error will be returned.

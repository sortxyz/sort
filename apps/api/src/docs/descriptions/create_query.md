Create a saved query you can share with your team or just execute again later.

The `query` field can either be a SQL query or an Intent query. An Intent query is a flexible format which can also be used from the [Sort UI](https://sort.xyz) to create Change Requests. SQL queries are plain SQL which provides maximum flexibility but no support for Change Requests in the Sort UI.

Let's look at some examples:

### SQL Query

#### Request body

```json
{
  "database_slug": "database-fake39x",
  "query": {
    "name": "Products SQL query",
    "description": "This query is amazing because it uses SQL to select from a table.",
    "type": "sql",
    "sql": "SELECT id, name, price FROM public.products WHERE price > 10.23 ORDER BY price DESC LIMIT 10"
  }
}
```

### Intent Query request body

```json
{
  "database_slug": "database-fake39x",
  "query": {
    "name": "Products Intent query",
    "description": "This uses an Intent query format because I want my team to easily change this data later.",
    "type": "intent",
    "intent": {
      "dml": "SELECT",
      "schema": "public",
      "table": "products",
      "columns": [
        "id", "name", "price"
      ],
      "filters": [
        {
          "column": "price",
          "op": ">",
          "value": "10.23"
        }
      ],
      "combinator": "AND",
      "orders": [
        {
          "column": "price",
          "direction": "DESC"
        }
      ],
      "limit": 10
    }
  }
}
```

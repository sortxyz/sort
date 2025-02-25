Runs a query on a database.

Queries can be run on any database to which you have access. You submit your query in the request body and the results are returned in the response.

_Tip: You can save your queries using the [Create Query](#tag/query/POST/v2/orgs/{org_slug}/queries) endpoint._

Sort offers two types of queries: SQL and Intent queries.

1. SQL queries support traditional SQL syntax providing maximum flexibility but limited Sort integration.
2. Intent queries are defined using JSON, offering a subset of SQL functionality while providing deep integration with Sort.

### When should I choose Intent vs SQL queries?

If you need to run queries utilizing features like JOINs and other familiar SQL syntax, and don't plan to integrate with other Sort features like [Sort Issues](https://docs.sort.xyz/docs/category/issues) or [Change Requests](https://docs.sort.xyz/docs/category/change-requests), use a SQL Query.

If you plan to save your queries so you and your collegues can use them with [Issues](https://docs.sort.xyz/docs/category/issues) or [Change Requests](https://docs.sort.xyz/docs/category/change-requests) or if you are building something advanced on top of the Sort API like a custom query-builder UI, you should use Intent queries. Intent queries offer a subset of SQL functionality but provide deep integration with Sort.

### Running a query

The only difference between running a SQL query and an Intent query is the format of the `query` field in the request body. Let's look at an example of an equivalent query using each format:

#### SQL Query

```json
{
  "database_slug": "database-fake39x",
  "query": {
    "type": "sql",
    "sql": "SELECT id, name, price FROM public.products WHERE price > 10.23 ORDER BY price DESC LIMIT 10"
  }
}
```

#### Intent Query

```json
{
  "database_slug": "database-fake39x",
  "query": {
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

##### Columns

An array of column names you want to select. Use `*` to select all columns.

##### Filters

An array of objects which define your `where` clause. Each object has three properties:

- `column`: The column name
- `op`: The operator. One of `=`, `!=`, `>`, `<`, `>=`, `<=`
- `value`: The value to compare against

##### Combinator

A string which defines how the filters are combined in the `where` clause. It can be either `AND` or `OR`. Multiple combinators are not supported at this time.

##### Orders

An array of objects which define the order of the results. Each object has two properties:

- `column`: The column name to order by
- `direction`: The direction, either `ASC`, `DESC`

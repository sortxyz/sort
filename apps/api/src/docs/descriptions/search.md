Search for Organizations, Databases, and Tables by name.

Set your search query in the `q` querystring parameter to narrow your results.
Searching is mostly performed by exact match but you can also use search scopes.

### Scopes

Search scopes allow you to narrow your results by specifc Organization name, database name and / or schema name. Scopes use the following format `{scope}:{value}`.

For example, if you want to find anything named `user` in schemas named `crm` in any Organization to which you have access:

```bash
curl -X GET \
  'https://api.sort.xyz/v2/search?q=schema%3Acrm%20account&limit=5' \
  -H 'accept: application/json' \
  -H 'x-api-key: YOUR_API_KEY'
```

The search results will be narrowed to only tables named `user` and any Org names which match. Matching Organizations are always included.

### Scope examples

- `db:Playground`
- `org:Sort`
- `schema:'my schema name'`

💡 _When the value includes whitespace, wrap the value in quotes._

All query text not included in a scope is used to match against the Organization name, database name and table name.

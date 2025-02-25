Searches for Change Requests in the given Organization and Database.

### Narrowing your search

#### Text

Set your search query in the `q` querystring parameter to narrow your results. Searching
is mostly performed by exact match but you can also use the following search scopes:

#### Scopes

- `status:open`
- `status:approved`
- `status:executing`
- `status:applied`
- `status:closed`
- `label:'my label'`
- `reviewer:username`

All query text not included in a scope is used to match against the Change
Request title and description.

### Examples

Searches for the first open Change Request containing the word "correction":

```bash
curl -X 'GET' \
  'https://api.sort.xyz/v2/orgs/ORG_SLUG/databases/DB_SLUG/search/change-requests?q=correction%20status%3Aopen%20&limit=1' \
  -H 'accept: application/json' \
  -H 'x-api-key: YOUR_API_KEY'
```

Searches for five Change Requests where Lamport is assigned as a reviewer and which have the "Docs" label:

```bash
curl -X 'GET' \
  'https://api.sort.xyz/v2/orgs/ORG_SLUG/databases/DB_SLUG/search/change-requests?q=reviewer%3ALamport%20label%3ADocs%20&limit=5' \
  -H 'accept: application/json' \
  -H 'x-api-key: YOUR_API_KEY'
```

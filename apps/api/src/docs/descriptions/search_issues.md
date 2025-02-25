Searches for Issues in the given Organization and Database.

### Narrowing your search

#### Text

Set your search query in the `q` querystring parameter to narrow your results. Searching
is mostly performed by exact match but you can also use the following search scopes:

#### Scopes

- `status:open`
- `status:closed`
- `label:'my label'`
- `assignee:username`

All query text not included in a scope is used to match against the Issue
title and description.

### Examples

Searches for the first open Issue containing the word "bug":

```bash
curl -X 'GET' \
  'https://api.sort.xyz/v2/orgs/ORG_SLUG/databases/DB_SLUG/search/issues?q=bug%20status%3Aopen%20&limit=1' \
  -H 'accept: application/json' \
  -H 'x-api-key: YOUR_API_KEY'
```

Searches for five Issues where Lamport is assigned and which have the "Docs" label:

```bash
curl -X 'GET' \
  'https://api.sort.xyz/v2/orgs/ORG_SLUG/databases/DB_SLUG/search/issues?q=reviewer%3ALamport%20label%3ADocs%20&limit=5' \
  -H 'accept: application/json' \
  -H 'x-api-key: YOUR_API_KEY'
```

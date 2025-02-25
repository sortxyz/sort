# Welcome

The Sort API allows you to query [Sort](https://sort.xyz) databases, create Issues and Change Requests, manage your account, and much more.

🔎 _If you already know what you're looking for, type CMD+k to quickly open search, or just use the search box in the left-hand nav._

## Getting started

### 1. Get your API key 🔑

First, visit [our docs page](https://docs.sort.xyz/docs/accounts/api-keys) to learn how to obtain your API key. Once you have your API key, move on to the next step.

### 2. Execute an HTTP request 🔄

When issuing HTTP requests to this API, you'll always set the `x-api-key` request header to your API key.  For example, if using `curl` this looks like:

```bash
curl --request GET \
  --url https://api.sort.xyz/v2/my/profile \
  --header 'x-api-key: YOUR_API_KEY' \
  --header 'accept: application/json' \
```

Run the above command to receive your first response from the Sort API.

### 3. Congratulations 🥳

Congratulations! You've successfully run your first HTTP request using the [Sort](https://sort.xyz) API. Next, check out the rest of our documentation for more examples of how you can integrate your project! 😎

## Useful links

- [Sort.xyz](https://sort.xyz)
- Documentation
  - [API Docs](https://api.sort.xyz/docs)
  - [Guides](https://docs.sort.xyz)
  - [OpenApi Spec](https://api.sort.xyz/docs/json)
- Social
  - [Blog](https://blog.sort.xyz/)
  - [Twitter](https://twitter.com/sort_xyz)
  - [Github](https://github.com/sortxyz)

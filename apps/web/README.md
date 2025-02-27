# Remix

This is a [Remix](https://remix.run/docs) site.

## Development

To run this Remix app locally, make sure your project's local dependencies are installed.

This project uses [pnpm][] to manage dependencies, so first enable `pnpm`:

```sh
corepack enable
```

Next, install the dependencies using `pnpm`:

```sh
pnpm install
```

Now set the required environment variables (see also [Remix docs](https://remix.run/docs/en/1.18.1/guides/envvars#local-development)):

```sh
cp .env.example .env
```

Set the `.env` vars (TBD) before running the project or the process will fail to start.

Afterwards, start the Remix development server like so:

```sh
pnpm dev
```

Open up [http://localhost:3000](http://localhost:3000) and you should be ready to go!

### Common Issues

<details>
<summary>Trouble getting VSCode to recognize your installed dependencies?</summary>

If VSCode is not recognizing that you've installed your dependencies, try adjusting your VSCode Settings to honor the TypeScript version configured in your Workspace.

- https://stackoverflow.com/questions/74642723/how-do-i-force-vs-code-to-always-use-my-workspaces-version-of-typescript-for-al
- https://github.com/microsoft/vscode/issues/172732
</details>

<details>
<summary>Do you want to run this project against your local REST API?</summary>

To run this project using a locally running Sort API backend, add the following to your `.env` file before starting up:

```bash
SORT_WEB_API_BASE_URL='http://127.0.0.1:8080'
```

Next, to sign in:

1. You'll need to first seed your database with our test user. Follow the [instructions here][seed-api-test-user].
1. Start up your local REST API
1. Now you can run this project and sign in using `test-user@sort.xyz` as the email address. Ask the team for the password.

</details>

[pnpm]: https://pnpm.io/
[seed-api-test-user]: https://github.com/sortxyz/sort/blob/develop/.github/CONTRIBUTING.md#test-users

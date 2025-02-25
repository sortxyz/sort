# sort-api-v2

Sort public API

## Getting started

_See also the [CONTRIBUTING](../../.github/CONTRIBUTING.md) and [DEBUGGING](./docs/DEBUGGING.md) documents._

### Prepare the API

Install all dependencies.

```bash
pnpm i
```

Copy `env.example` to `.env.development` and `.env`. Update values as needed.

```bash
cp .env.example .env.development
```

### Start all infrastructure resources and seed the dev database

```bash
pnpm db:reset
```

All necessary Docker images will be downloaded and the containers will be started.

**NOTE**: this completely wipes your local sort dev database and restores the
default seed state.

## Development workflow

Start the API by running the `dev` command:

```bash
pnpm dev
```

Nodemon will monitor the API and it will be reloaded automatically when changes are made.

## Testing

Confirm all automated tests pass (unit/integration) by running:

```bash
pnpm test:all
```

If you want to run all of the tests one-at-a-time, execute:

```bash
pnpm test
```

### Test user

In our AWS environments we have a special test user you can optionally use when
logging in via Auth0. The email address is `test-user@sort.xyz`. For the
password, you'll need to ask a member of the team.

### Code standards

Check if the source code files still are aligned with the project code standards:

```bash
pnpm lint
```

You can try automatically fix warnings/errors by running `pnpm lint:fix`.

## API Documentation

The project uses a Swagger to document and try every endpoint of the project.
You can access it by navigating to `http://localhost:8080/docs` once the API is
running locally. Here are the docs for the dev and production environments:

- [development](https://api.development.sort.xyz/docs/static/index.html)
- [production](https://api.sort.xyz/docs/static/index.html)

## Environment variables

See `env.example`.

## Feature flags

Features can be enabled or disabled per environment using feature flags.
Feature flags come in handy when working on a feature which you are not ready to
share with customers but which contains a large number of changes which are
better managed by merging into main to be kept up to date with the rest of the
codebase. Feature flags are controlled via environment variables which follow a
specfic naming convention (see below).

### Feature flag naming conventions

Feature flags are controlled via environment variables and follow the following naming convention:

```
SORT_FEAT_ENABLE_YOUR_FEATURE_NAME
```

The `SORT_FEAT_ENABLE_` prefix is **required**.

### Using feature flags

To enable a feature,

1. Set the value of the feature flag environment variable to the string `'true'`.
   Any other value will be treated as disabling the feature.

For example:

```sh
export SORT_FEAT_ENABLE_MY_COOL_FEATURE=true
```

2. In your codebase, import the feature flag helper and enable your code depending on it's result:

```ts
import { isFeatureEnabled } from './utils/featureFlags.utils'

if (isFeatureEnabled('MY_COOL_FEATURE')) {
  exposeTheCoolFeature()
}
```

### Testing features hidden behind flags

To make testing of features easier, **feature flags are always enabled in test
environments** so only merge features which do not break the test suite, even if
behind a feature flag.

## Scripts

| Script | Description |
| ------ | ----------- |
| prepare | Generate final files (transpiled, minified and packaged) to be deployed into cloud environments |
| copy-mailgun-template | Copy mailgun template between production and sandbox environments |
| db:reset | Drop and recreate the database from lastest commit |
| infra:down | Stop and remove all Docker containers |
| infra:up | Start all Docker containers using `docker compose` |
| lint:fix | Check and try to fix error/warnings automatically |
| lint | Check the code standards |
| open:cov | Open the coverage report from `test:cov` in the browser |
| open:openapi:report | Open the coverage report from `test:openapi` in the browser |
| open:openapi:spec | Open the generated spec from `test:openapi` in the browser |
| dev | Start the local development server in watch mode (listening changes into source code) |
| start | Start the local development server pointing to the `dist` folder instead source code |
| test:all | Run all tests once including OpenAPI lint |
| test:cov | Run all tests once and collect the coverage |
| test:watch | Run all tests and keep in watch mode waiting for new code changes to rerun them |
| test:changed | Run test for only the files which have changed |
| test:openapi | Run lint on our OpenAPI spec and output a report to the file system |
| test:openapi:report | Run lint on our OpenAPI spec and open the report in a browser |
| test:openapi:lint | Run lint on our OpenAPI spec |
| jest | Run all tests once |
| test | Run code lint, all tests and lint OpenAPI spec |

## Main technologies

- `AWS`: Host the API in the cloud
- `Commitlint`: Lint commit messages
- `Cross Env`: Running scripts with environment variable accross platforms
- `ESlint`: Keep all base code standarlized
- `Fastify`: Create and manage the API server
- `GitHub Actions`: Pipelines for CI/CD
- `Jest`: Manage all unit and integration tests
- `Lint Staged`: Apply scripts to staged files
- `pnpm`: Manage project dependencies and scripts
- `Prettier`: Format all codes automatically
- `Typebox`: Manage and validate schemas
- `Typescript`: Super set for Javascript with type checking
- `Swagger`: Document all API endpoints
- `Web3`: Interact with blockchains

## GitHub Workflows

- Dependabot setup with automatic merging thanks to ["merge dependabot" GitHub action](https://github.com/fastify/github-action-merge-dependabot)
- Notifications about commits waiting to be released thanks to ["notify release" GitHub action](https://github.com/nearform/github-action-notify-release)
- PRs' linked issues check with ["check linked issues" GitHub action](https://github.com/nearform/github-action-check-linked-issues)
- Continuous Integration GitHub workflow

## Infrastructure

- Cloud provider: `AWS`
- Containers: `Docker`
- Containers orchestration: `Kubernetes`
- Database: `AWS RDS` (with PostgresQL)
- Dashboards: `Grafana`
- Metrics: `AWS CloudWatch`
- Pipelines: `GitHub Actions` and `ArgoCD`

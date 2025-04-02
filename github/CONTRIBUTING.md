This project is organized as follows:

- `apps` This directory is the home of all applications.
- `packages` This directory is the home of all shared code, used by more than one app.

We use `pnpm` to manage this monorepo.

# apps/api

The following describes the `apps/api` project.

- `src/global` This directory is for functionality common across all API versions. If you need to share a utility, constant, type etc across multiple versions of the Sort API, put that here. Top level / unversioned API routes (e.g. `/robots.txt`) belong here too.
- `src/v2` Version two of the Sort API.

Each of the above directories follow the following subdirectory structure:

- `/constants` Version specific values which are not intended to change.
- `/controllers` Version specific business logic.
- `/mocks` Version specific mocks used in tests.
- `/routes` Version specific API route definitions which map public API routes to controllers.
- `/services` Version specific 3rd party service abstractions. This is where your API version specific Database/ChatGPT/Discord etc abstractions belong.
- `/types` Version specific TypeScript types.
- `/utils` Version specific shared helpers.

All mocks, services, types and utils should be added to `packages/shared` unless
intended to _only_ be used in the API.

## File names

File naming convention is: `lower-case.topic.ts`.

- Words are lowercase and separated with `-`.

### Topics

File names use the `topic` naming convention, where the singular version of the
top-level version directory name (`global`, `v2`, etc) is placed at the end of the filename before the
file extention. This makes it easier to see the purpose of each file when you
have multiple files open at the same time.

```
v2/
├─ services/
│  ├─ user.service.ts
├─ controllers/
│  ├─ user.controller.ts
│  ├─ organizations/
│  │  ├─ invite.controller.ts # Note "controller" not "organization"
├─ routes/
│  ├─ user.route.ts
```

### Test file names

Tests are colocated in the same directory as the functionality. Test file names
are identical to the file they are testing except they end with `.test.ts`.
Example:

```
services/
├─ user.service.ts
├─ user.service.test.ts # <-- Contains the tests for the functionality in user.service.ts
```

## Snake case

API input and response fields must use `snake_case`.

## Test users

If you are testing the [UI][] and the API together locally, you'll first need
to seed your local database with our test user. Run the following command from
the `apps/api` directory:

```sh
pnpm db:reset
```

This will run the latest version of the database locally and add our test user account to it. Now you can
[log in through your local UI][local-login] without trouble.

## OpenAPI

We generate an [OpenAPI spec](https://swagger.io/specification/) from our route/controller schemas. The spec is part
of our public product offering so care should be taken to ensure it's accuracy.
Follow these guidelines when added or editing API endpoints.

### 1. OpenAPI descriptions

The values for all OpenAPI endpoint descriptions are found in the `src/docs`
directory. Each endpoint has a file in this directory named after it's
`operationId` and suffixed with `.md`. Using dedicated markdown files allows us
to get full markdown syntax highlighting in our editor and no need for escaping
strings etc.

For example, if the `operationId` is `list_changes`, then the documentation file
is found in `apps/api/src/docs/list_changes.md`.

The values of these files are included in the generated OpenAPI spec automatically.

If you are adding a new endpoint, make sure to add a description file.

Guidelines for writing descriptions: A full sentence or paragraph(s) describing
to developers the purpose of the endpoint and anything helpful. Use markdown in
this field for things like links to our docs.sort.xyz site. End each sentence
with a period. Take a look at some other files for examples.

### 2. Ensure the endpoint schema includes the following fields
    - `operationId` A unique name for the endpoint
    - `summary` A sentence fragment about what the endpoint does. Do not end with a period.

For `summary` and `description` fields, capitalize our product entities like `Organization`,
`Issue` and `Change Request`.

Example

```ts
export const getOrganizationBySlugSchema = {
  headers: AuthHeadersSchema,
  params: ParamsSchema,
  summary: 'Get a Sort Organization',
  // description -> This comes from src/docs/get_organization.md
  operationId: 'get_organization',
  response: {
    200: createMessageSchema(
      'get_organization',
      Type.Object({
        organization: OrganizationSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema
```

You can preview what this will look like by running the API locally and visiting: http://localhost:8080/docs/static/index.html

### 2. Hide endpoints which are not ready or not intended for public use

You can prevent endpoints from being included in our public OpenAPI spec by
setting `hide: true` in the endpoint schema.

```ts
export const getMyHiddenThingsSchema = {
  headers: AuthHeadersSchema,
  params: ParamsSchema,
  summary: 'Get something hidden from the public',
  description: 'Gets hidden stuff.',
  operationId: 'getMyHiddenThings',
  hide: true, // <===
  ...
}
```

[UI]: https://github.com/sortxyz/sort/tree/main/apps/web
[local-login]: https://github.com/sortxyz/sort/tree/main/apps/web#common-issues

# apps/worker

The following describes the `apps/worker` project.

All mocks, services, types and utils should be added to `packages/shared` unless
intended to _only_ be used in the worker.

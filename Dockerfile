# https://pnpm.io/docker#example-2-build-multiple-docker-images-in-a-monorepo
FROM node:22.11-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apk add --update --no-cache make gcc g++ musl-dev dumb-init
RUN apk add --update --no-cache python3 && ln -sf python3 /usr/bin/python
RUN npm install -g corepack@latest
RUN corepack enable pnpm

FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm deploy --filter=@sort/api --prod /prod/api
RUN pnpm deploy --filter=@sort/worker --prod /prod/worker
RUN pnpm --filter=@sort/web build
RUN pnpm deploy --filter=@sort/web /prod/web

FROM base AS api
COPY --from=build /prod/api /prod/api
WORKDIR /prod/api
EXPOSE 8080
# Max-old-space must be less than total container memory to leave memory for other uses
# https://nodejs.org/api/cli.html#cli_max_old_space_size_size_in_megabytes
# https://developer.ibm.com/articles/nodejs-memory-management-in-container-environments/
CMD ["dumb-init", "node", "--max-old-space-size=2400", "./dist/index.js"]

FROM base AS worker
COPY --from=build /prod/worker /prod/worker
WORKDIR /prod/worker
EXPOSE 8080
# Max-old-space comes from 3/4 of the container memory - https://nodejs.org/api/cli.html#cli_max_old_space_size_size_in_megabytes
CMD ["dumb-init", "node", "--max-old-space-size=550", "./dist/index.js"]

FROM base AS web
COPY --from=build /prod/web /prod/web
WORKDIR /prod/web
EXPOSE 3000
CMD ["dumb-init", "node", "./node_modules/@react-router/serve/dist/cli.js", "./build/server/index.js"]

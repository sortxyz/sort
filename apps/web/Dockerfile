# Build stage
FROM node:22.11-alpine AS deps

RUN npm install -g corepack@latest
RUN corepack enable pnpm

WORKDIR /usr/src/app

# Install only production dependencies
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:22.11-alpine AS builder

# Enable corepack for build stage only
RUN npm install -g corepack@latest
RUN corepack enable pnpm

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# Copy source and build
COPY . .
RUN NODE_ENV=production pnpm run build

# Production stage
FROM node:22.11-alpine AS runner

RUN apk add --no-cache curl dumb-init

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

RUN mkdir -p /usr/src/app && \
    chown -R node:node /usr/src/app

USER node

WORKDIR /usr/src/app

COPY --chown=node:node package.json pnpm-lock.yaml ./
COPY --chown=node:node --from=deps /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/build ./build

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "./node_modules/@remix-run/serve/dist/cli.js", "./build/server/index.js"]

import { z } from "zod";

const EnvBooleanSchema = z
  .preprocess((val) => val === "1", z.boolean())
  .default(false);

const UnsetSortTelemetryServerEnvSchema = z.object({
  SORT_TELEMETRY: z.undefined(),
});

const SentrySortTelemetryServerEnvSchema = z.object({
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_DSN: z.string(),
  SENTRY_ENV: z.string().default("development"),
  SORT_TELEMETRY: z.literal("sentry"),
});

const SortTelemetryServerEnvSchema = z.discriminatedUnion("SORT_TELEMETRY", [
  UnsetSortTelemetryServerEnvSchema,
  SentrySortTelemetryServerEnvSchema,
]);

const FormSortAuthServerEnvSchema = z.object({
  SORT_AUTH: z.literal("form"),
  SORT_JWT_SECRET: z.string(),
});

const Auth0SortAuthServerEnvSchema = z.object({
  SORT_AUTH: z.literal("auth0"),
  AUTH0_CLIENT_ID: z.string(),
  AUTH0_CLIENT_SECRET: z.string(),
  AUTH0_ISSUER_BASE_URL: z.string(),
});

const SortAuthServerEnvSchema = z.discriminatedUnion("SORT_AUTH", [
  FormSortAuthServerEnvSchema,
  Auth0SortAuthServerEnvSchema,
]);

const UnsetSortHostedThroughServerEnvSchema = z.object({
  SORT_HOSTED_THROUGH: z.undefined(),
});

const VercelSortHostedThroughServerEnvSchema = z.object({
  SORT_HOSTED_THROUGH: z.literal("vercel"),
  VERCEL: EnvBooleanSchema,
  VERCEL_ENV: z.string(),
  VERCEL_FLAGS_SECRET: z.string(),
});

const SortHostedThroughServerEnvSchema = z.discriminatedUnion(
  "SORT_HOSTED_THROUGH",
  [
    VercelSortHostedThroughServerEnvSchema,
    UnsetSortHostedThroughServerEnvSchema,
  ],
);

const UnsetSortAIServerEnvSchema = z.object({
  SORT_AI: z.undefined(),
});

const OpenaiSortAIServerEnvSchema = z.object({
  SORT_AI: z.literal("openai"),
  OPENAI_API_KEY: z.string(),
  OPENAI_ASSISTANT_ID: z.string(),
  SORT_WEB_DESCRIBE_CHANGES_ENABLED: EnvBooleanSchema,
});

const SortAIServerEnvSchema = z.discriminatedUnion("SORT_AI", [
  UnsetSortAIServerEnvSchema,
  OpenaiSortAIServerEnvSchema,
]);

const UnsetSortAnalyticsServerEnvSchema = z.object({
  SORT_ANALYTICS: z.undefined(),
});

const PosthogSortAnalyticsServerEnvSchema = z.object({
  SORT_ANALYTICS: z.literal("posthog"),
});

const SortAnalyticsServerEnvSchema = z.discriminatedUnion("SORT_ANALYTICS", [
  UnsetSortAnalyticsServerEnvSchema,
  PosthogSortAnalyticsServerEnvSchema,
]);

const BaseServerEnvSchema = z.object({
  HOST: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.string().optional(),
  SORT_SERVICE_ACCOUNT_API_KEY: z.string(),
  SORT_SESSION_REVOKE_SECRET: z.string(),
  SORT_WEB_API_BASE_URL: z.string(),
  SORT_WEB_CHANGE_REQUESTS_ENABLED: EnvBooleanSchema,
  SORT_WEB_MAINTENANCE_ENABLED: EnvBooleanSchema,
  SORT_WEB_SESSION_SECRET: z.string(),
});

const ServerEnvSchema = BaseServerEnvSchema.and(SortAIServerEnvSchema)
  .and(SortAnalyticsServerEnvSchema)
  .and(SortAuthServerEnvSchema)
  .and(SortHostedThroughServerEnvSchema)
  .and(SortTelemetryServerEnvSchema);

const SortTelemetryBrowserEnvSchema = z.discriminatedUnion("SORT_TELEMETRY", [
  UnsetSortTelemetryServerEnvSchema,
  SentrySortTelemetryServerEnvSchema.pick({
    SENTRY_DSN: true,
    SENTRY_ENV: true,
    SORT_TELEMETRY: true,
  }),
]);

const SortAnalyticsBrowserEnvSchema = z.union([
  UnsetSortAnalyticsServerEnvSchema.pick({
    SORT_ANALYTICS: true,
  }),
  PosthogSortAnalyticsServerEnvSchema.pick({
    SORT_ANALYTICS: true,
  }),
]);

const SortHostedThroughBrowserEnvSchema = z.union([
  UnsetSortHostedThroughServerEnvSchema.pick({
    SORT_HOSTED_THROUGH: true,
  }),
  VercelSortHostedThroughServerEnvSchema.pick({
    SORT_HOSTED_THROUGH: true,
  }),
]);

const BaseBrowserEnvSchema = BaseServerEnvSchema.pick({
  NODE_ENV: true,
});

const BrowserEnvSchema = BaseBrowserEnvSchema.and(SortAnalyticsBrowserEnvSchema)
  .and(SortHostedThroughBrowserEnvSchema)
  .and(SortTelemetryBrowserEnvSchema);

export type ServerEnv = z.infer<typeof ServerEnvSchema>;
export type BrowserEnv = z.infer<typeof BrowserEnvSchema>;

export const serverEnv = ServerEnvSchema.parse(process.env);
export const browserEnv = BrowserEnvSchema.parse(process.env);

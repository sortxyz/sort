import type { RouteConfig } from "@react-router/dev/routes";
import { index, layout, prefix, route } from "@react-router/dev/routes";

export default [
  index("routes/_webflow.tsx"),
  route("health", "routes/health.tsx"),
  route(".well-known/vercel/flags", "routes/_well-known/vercel/flags.tsx"),
  route("maintenance", "routes/maintenance.tsx"),
  route("pricing", "routes/_webflow.tsx", { id: "routes/pricing" }),
  ...prefix("api/auth", [
    route("callback", "routes/api.auth.callback.tsx"),
    route("login", "routes/api.auth.login.tsx"),
    route("logout", "routes/api.auth.logout.tsx"),
  ]),
  ...prefix("platforms", [
    route("postgres", "routes/_webflow.tsx", {
      id: "routes/platforms/postgres",
    }),
    route("snowflake", "routes/_webflow.tsx", {
      id: "routes/platforms/snowflake",
    }),
  ]),
  ...prefix("solutions", [
    route("community-managers", "routes/_webflow.tsx", {
      id: "routes/solutions/community-managers",
    }),
    route("customer-support", "routes/_webflow.tsx", {
      id: "routes/solutions/customer-support",
    }),
    route("data-teams", "routes/_webflow.tsx", {
      id: "routes/solutions/data-teams",
    }),
    route("internal-operations", "routes/_webflow.tsx", {
      id: "routes/solutions/internal-operations",
    }),
  ]),
  ...prefix("use-cases", [
    route("ai-and-llms", "routes/_webflow.tsx", {
      id: "routes/use-cases/ai-and-llms",
    }),
    route("centralized-data-platform", "routes/_webflow.tsx", {
      id: "routes/use-cases/centralized-data-platform",
    }),
    route("customer-support-internal-operations", "routes/_webflow.tsx", {
      id: "routes/use-cases/customer-support-internal-operations",
    }),
    route("data-change-management", "routes/_webflow.tsx", {
      id: "routes/use-cases/data-change-management",
    }),
    route("data-discovery", "routes/_webflow.tsx", {
      id: "routes/use-cases/data-discovery",
    }),
    route("data-issue-management", "routes/_webflow.tsx", {
      id: "routes/use-cases/data-issue-management",
    }),
    route("data-quality", "routes/_webflow.tsx", {
      id: "routes/use-cases/data-quality",
    }),
  ]),

  layout("layouts/public.tsx", [
    route("explore", "routes/explore.tsx"),
    route("privacy-policy", "routes/privacy-policy.tsx"),
    route("search", "routes/search.tsx"),
    route("terms-of-service", "routes/terms-of-service.tsx"),
    route("login", "routes/login.tsx"),
  ]),

  layout("layouts/app.tsx", [
    route("confirm/email", "routes/confirm.email.tsx"),
    ...prefix("my", [
      route("email-preferences", "routes/my.email-preferences.tsx"),
      route("orgs", "routes/my.orgs.tsx"),
      route("profile", "routes/my.profile.tsx", [
        index("routes/my.profile.index.tsx"),
        route("api-keys", "routes/my.profile.api-keys.tsx", [
          index("routes/my.profile.api-keys.index.tsx"),
          route("new", "routes/my.profile.api-keys.new.tsx"),
        ]),
      ]),
    ]),
    ...prefix("orgs", [
      route("new", "routes/orgs/new.tsx"),
      route(
        ":org_slug/invites/:invite_id",
        "routes/orgs/$org_slug.invites.$invite_id.tsx",
      ),
      route(":org_slug", "routes/orgs/$org_slug.tsx", [
        index("routes/orgs/$org_slug/index.tsx"),
        route("dashboard", "routes/orgs/$org_slug/dashboard.tsx"),
        ...prefix("databases", [
          index("routes/orgs/$org_slug/databases.tsx"),
          route(
            ":database_slug",
            "routes/orgs/$org_slug/databases/$database_slug.tsx",
            [
              index("routes/orgs/$org_slug/databases/$database_slug/index.tsx"),
              route(
                "change-requests",
                "routes/orgs/$org_slug/databases/$database_slug/change-requests.tsx",
                [
                  index(
                    "routes/orgs/$org_slug/databases/$database_slug/change-requests/index.tsx",
                  ),
                  route(
                    ":change_request_number",
                    "routes/orgs/$org_slug/databases/$database_slug/change-requests/$change_request_number.tsx",
                    [
                      index(
                        "routes/orgs/$org_slug/databases/$database_slug/change-requests/$change_request_number/index.tsx",
                      ),
                      route(
                        "data-changes",
                        "routes/orgs/$org_slug/databases/$database_slug/change-requests/$change_request_number/data-changes.tsx",
                      ),
                    ],
                  ),
                  route(
                    ":change_request_number",
                    "routes/orgs/$org_slug/databases/$database_slug/change-requests/$change_request_number/explorer/layout.tsx",
                    [
                      ...prefix("explorer", [
                        index(
                          "routes/orgs/$org_slug/databases/$database_slug/change-requests/$change_request_number/explorer/index.tsx",
                        ),
                        route(
                          "schemas/:schema_name/tables",
                          "routes/orgs/$org_slug/databases/$database_slug/change-requests/$change_request_number/explorer/schemas.$schema_name.tables.tsx",
                          [
                            route(
                              ":table_name",
                              "routes/orgs/$org_slug/databases/$database_slug/change-requests/$change_request_number/explorer/schemas.$schema_name.tables.$table_name.tsx",
                            ),
                          ],
                        ),
                      ]),
                    ],
                  ),
                ],
              ),
              route(
                "edit",
                "routes/orgs/$org_slug/databases/$database_slug/edit.tsx",
              ),
              ...prefix("explorer", [
                index(
                  "routes/orgs/$org_slug/databases/$database_slug/explorer.tsx",
                ),
                route(
                  "describe",
                  "routes/orgs/$org_slug/databases/$database_slug/explorer/describe.tsx",
                ),
                route(
                  "queries",
                  "routes/orgs/$org_slug/databases/$database_slug/explorer/queries.tsx",
                  [
                    route(
                      ":query_id",
                      "routes/orgs/$org_slug/databases/$database_slug/explorer/queries.$query_id.tsx",
                    ),
                  ],
                ),
                route(
                  "schemas/:schema_name/tables",
                  "routes/orgs/$org_slug/databases/$database_slug/explorer/schemas.$schema_name.tables.tsx",
                  [
                    route(
                      ":table_name",
                      "routes/orgs/$org_slug/databases/$database_slug/explorer/schemas.$schema_name.tables.$table_name.tsx",
                    ),
                  ],
                ),
              ]),
              route(
                "issues",
                "routes/orgs/$org_slug/databases/$database_slug/issues.tsx",
                [
                  index(
                    "routes/orgs/$org_slug/databases/$database_slug/issues/index.tsx",
                  ),
                  route(
                    ":issue_number",
                    "routes/orgs/$org_slug/databases/$database_slug/issues/$issue_number.tsx",
                  ),
                  route(
                    "new",
                    "routes/orgs/$org_slug/databases/$database_slug/issues/new.tsx",
                  ),
                ],
              ),
              route(
                "labels",
                "routes/orgs/$org_slug/databases/$database_slug/labels.tsx",
                [
                  index(
                    "routes/orgs/$org_slug/databases/$database_slug/labels/index.tsx",
                  ),
                  route(
                    "new",
                    "routes/orgs/$org_slug/databases/$database_slug/labels/new.tsx",
                  ),
                  route(
                    ":label_id",
                    "routes/orgs/$org_slug/databases/$database_slug/labels/$label_id.tsx",
                    [
                      route(
                        "edit",
                        "routes/orgs/$org_slug/databases/$database_slug/labels/$label_id.edit.tsx",
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ]),
        route("members", "routes/orgs/$org_slug/members.tsx", [
          index("routes/orgs/$org_slug/members.index.tsx"),
          route("invites", "routes/orgs/$org_slug/members.invites.tsx", [
            route("new", "routes/orgs/$org_slug/members.invites.new.tsx"),
          ]),
        ]),
        route("settings", "routes/orgs/$org_slug/settings.tsx", [
          index("routes/orgs/$org_slug/settings/index.tsx"),
          route(
            "connections",
            "routes/orgs/$org_slug/settings/connections.tsx",
            [
              index("routes/orgs/$org_slug/settings/connections/index.tsx"),
              route(
                ":connection_id/edit",
                "routes/orgs/$org_slug/settings/connections/$connection_id.edit.tsx",
                [
                  index(
                    "routes/orgs/$org_slug/settings/connections/$connection_id.edit.index.tsx",
                  ),
                  route(
                    "advanced",
                    "routes/orgs/$org_slug/settings/connections/$connection_id.edit.advanced.tsx",
                  ),
                ],
              ),
              route(
                "add-connection",
                "routes/orgs/$org_slug/settings/connections/add-connection.tsx",
                [
                  index(
                    "routes/orgs/$org_slug/settings/connections/add-connection.index.tsx",
                  ),
                  route(
                    ":data_provider",
                    "routes/orgs/$org_slug/settings/connections/add-connection.$data_provider.tsx",
                    [
                      index(
                        "routes/orgs/$org_slug/settings/connections/add-connection.$data_provider.index.tsx",
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ]),
      ]),
    ]),
  ]),
] satisfies RouteConfig;

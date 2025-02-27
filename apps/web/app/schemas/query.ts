import type { V2 } from "@sort/sdk";
import { z } from "zod";

function getBaseValueSchemaForColumn(column: V2.Column) {
  switch (column.type) {
    case "binary":
      return z.string().base64("Invalid Base64");
    case "json":
      return z.string().refine((v) => {
        try {
          JSON.parse(v);
          return true;
        } catch {
          return false;
        }
      }, "Invalid JSON");
    case "uuid":
      return z.string().uuid("Invalid UUID");
    case "boolean":
      return z
        .string()
        .refine((v) => ["TRUE", "FALSE"].includes(v.toUpperCase()));
    case "date":
      return z.string().datetime();
    case "numeric":
      return z
        .string()
        .refine((v) => v.trim() !== "" && Number.isFinite(Number(v)));
    default:
      return z.string();
  }
}

function getValueSchemaForColumn(column: V2.Column) {
  return column.nullable
    ? z.union([
        z
          .string()
          .refine((v) => v.toUpperCase() === "NULL")
          .transform(() => "NULL"),
        getBaseValueSchemaForColumn(column),
      ])
    : getBaseValueSchemaForColumn(column);
}

export function getFilterColumnDef(columns: V2.Column[]): z.ZodObject<{
  column: z.ZodString;
  op: z.ZodEnum<["=", "!=", ">", "<", ">=", "<="]>;
  value: z.ZodString;
}> {
  switch (columns.length) {
    case 0:
      return z.object({
        column: z.string(),
        op: z.enum(["=", "!=", ">", "<", ">=", "<="]),
        value: z.string(),
      });
    case 1: {
      const cx = columns as [V2.Column];
      return z.object({
        column: z.literal(cx[0].name),
        op: z.enum(["=", "!=", ">", "<", ">=", "<="]),
        value: getValueSchemaForColumn(cx[0]),
      }) as never;
    }
    default: {
      const cx = columns as [V2.Column, V2.Column, ...V2.Column[]];
      return z.discriminatedUnion(
        "column",
        // @ts-expect-error - this will always be a type error because its dynamic
        cx.map((column) =>
          z.object({
            column: z.literal(column.name),
            op: z.enum(["=", "!=", ">", "<", ">=", "<="]),
            value: getValueSchemaForColumn(column),
          }),
        ),
      ) as never;
    }
  }
}

type BuildQuerySchemaDefaults = {
  intent: {
    columns: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    filters: z.ZodDefault<
      z.ZodArray<
        z.ZodObject<{
          column: z.ZodString;
          op: z.ZodEnum<["=", "!=", ">", "<", ">=", "<="]>;
          value: z.ZodString;
        }>
      >
    >;
    schema: z.ZodDefault<z.ZodString>;
    table: z.ZodDefault<z.ZodString>;
  };
};

const queryBase = z.object({
  connection_id: z.string().optional(),
  created_at: z.string().optional(),
  created_by_name: z.string().optional(),
  created_by_picture: z.string().optional(),
  created_by_username: z.string().optional(),
  created_by: z.string().optional(),
  database_name: z.string().optional(),
  database_slug: z.string().optional(),
  description: z.string().nullable().default(null),
  id: z.string().optional(),
  name: z.string().optional(),
  org_slug: z.string().optional(),
  updated_at: z.string().optional(),
});

export function buildQuerySchema(
  defaults: BuildQuerySchemaDefaults = {
    intent: {
      columns: z.array(z.string()).min(1).default([]),
      filters: z
        .array(
          z.object({
            column: z.string(),
            op: z.enum(["=", "!=", ">", "<", ">=", "<="]),
            value: z.string(),
          }),
        )
        .default([]),
      schema: z.string().min(1).default(""),
      table: z.string().min(1).default(""),
    },
  },
) {
  return z.discriminatedUnion("type", [
    queryBase.extend({
      type: z.literal("intent").default("intent"),
      intent: z
        .object({
          ...defaults.intent,
          limit: z.number().int().min(1).max(100).default(100),
          combinator: z.enum(["AND", "OR"]).default("AND"),
          dml: z.literal("SELECT").default("SELECT"),
          orders: z
            .array(
              z.object({
                direction: z.enum(["ASC", "DESC"]),
                column: z.string(),
              }),
            )
            .default([]),
        })
        .default({}),
    }),
    queryBase.extend({
      type: z.literal("sql"),
      sql: z.string(),
    }),
  ]);
}

export function buildCreateOrUpdateQuerySchema(
  defaults?: BuildQuerySchemaDefaults,
) {
  return buildQuerySchema(defaults)
    .transform((value) => {
      const {
        connection_id: _connection_id,
        created_at: _created_at,
        created_by: _created_by,
        created_by_name: _created_by_name,
        created_by_picture: _created_by_picture,
        created_by_username: _created_by_username,
        database_name: _database_name,
        database_slug: _database_slug,
        id: _id,
        org_slug: _org_slug,
        updated_at: _updated_at,
        ...query
      } = value;
      return query;
    })
    .refine(
      // eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
      (query): query is V2.CreateQuery | V2.UpdateQuery =>
        query.name !== undefined,
      {
        message: "Name is required",
        path: ["name"],
      },
    );
}

export function buildRunQueryIntentSchema(defaults?: BuildQuerySchemaDefaults) {
  return z.object({
    intent: z.literal("runQuery"),
    query: buildQuerySchema(defaults).default({ type: "intent" }),
  });
}

export function buildCreateQueryIntentSchema(
  defaults?: BuildQuerySchemaDefaults,
) {
  return z.object({
    intent: z.literal("createQuery"),
    query: buildCreateOrUpdateQuerySchema(defaults),
  });
}

export function buildUpdateQueryIntentSchema(
  defaults?: BuildQuerySchemaDefaults,
) {
  return z.object({
    intent: z.literal("updateQuery"),
    query: buildCreateOrUpdateQuerySchema(defaults),
  });
}

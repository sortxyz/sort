import type { V2 } from "@sort/sdk";
import { z } from "zod";

const nullChangeFieldValueSchema = z.object({
  column_name: z.string(),
  type: z.enum([
    "string",
    "numeric",
    "boolean",
    "date",
    "json",
    "uuid",
    "binary",
  ]),
  value_type: z.literal("null"),
  value: z.any().transform(() => null),
});

const undefinedChangeFieldValueSchema = z.object({
  column_name: z.string(),
  type: z.enum([
    "string",
    "numeric",
    "boolean",
    "date",
    "json",
    "uuid",
    "binary",
  ]),
  value_type: z.literal("undefined"),
  value: z.any().transform(() => undefined),
});

const stringChangeFieldValueSchema = z.object({
  column_name: z.string(),
  type: z.literal("string"),
  value_type: z.literal("string"),
  value: z
    .string()
    .optional()
    .transform((value) => value ?? ""),
});

const numericChangeFieldValueSchema = z.object({
  column_name: z.string(),
  type: z.literal("numeric"),
  value_type: z.literal("numeric"),
  value: z.union([z.number(), z.string().regex(/\d+/, "Invalid BigInt")]),
});

const booleanChangeFieldValueSchema = z.object({
  column_name: z.string(),
  type: z.literal("boolean"),
  value_type: z.literal("boolean"),
  value: z.boolean().optional().default(false),
});

const dateChangeFieldValueSchema = z.object({
  column_name: z.string(),
  type: z.literal("date"),
  value_type: z.literal("date"),
  value: z.preprocess((x) => {
    if (typeof x === "string") {
      const utcDateString = x.endsWith("Z") ? x : `${x}Z`;
      const utcDate = new Date(utcDateString);
      if (utcDate.toString() === "Invalid Date") {
        return x;
      }
      return utcDate.toISOString();
    }

    return x;
  }, z.string().datetime()),
});

const jsonChangeFieldValueSchema = z.object({
  column_name: z.string(),
  type: z.literal("json"),
  value_type: z.literal("json"),
  value: z.string().superRefine((v, ctx) => {
    try {
      JSON.parse(v);
      return true;
    } catch (err) {
      if (err instanceof Error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err.message,
        });
      } else {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid JSON",
        });
      }

      return z.NEVER;
    }
  }),
});

const uuidChangeFieldValueSchema = z.object({
  column_name: z.string(),
  type: z.literal("uuid"),
  value_type: z.literal("uuid"),
  value: z.string().uuid(),
});

const binaryChangeFieldValueSchema = z.object({
  column_name: z.string(),
  type: z.literal("binary"),
  value_type: z.literal("binary"),
  value: z.string().refine((v) => {
    try {
      atob(v);
      return true;
    } catch {
      return false;
    }
  }, "Invalid base64"),
});

export const changeFieldValueSchema = z.discriminatedUnion("value_type", [
  nullChangeFieldValueSchema,
  undefinedChangeFieldValueSchema,
  stringChangeFieldValueSchema,
  numericChangeFieldValueSchema,
  booleanChangeFieldValueSchema,
  dateChangeFieldValueSchema,
  jsonChangeFieldValueSchema,
  uuidChangeFieldValueSchema,
  binaryChangeFieldValueSchema,
]);

export const changeFieldValueApiSchema = changeFieldValueSchema.transform(
  ({ type: _, value_type: __, ...field }) => field,
);

function fieldsTransform(
  fields: z.output<typeof changeFieldValueApiSchema>[],
  ctx: z.RefinementCtx,
): Extract<V2.CreateChange, { action: "ADD" }>["fields"] {
  const defined = fields.filter((field) => field.value !== undefined);
  if (defined.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_small,
      message: "Array must contain at least 1 element(s)",
      minimum: 1,
      inclusive: true,
      type: "array",
    });
    return z.NEVER;
  }

  return defined;
}

export const modifyChangeSchema = z.object({
  action: z.literal("MODIFY"),
  fields: z.array(changeFieldValueApiSchema).min(1).transform(fieldsTransform),
  primary_keys: z
    .array(changeFieldValueApiSchema)
    .min(1)
    .transform(fieldsTransform),
  schema_name: z.string(),
  table_name: z.string(),
});

export const deleteChangeSchema = z.object({
  action: z.literal("DELETE"),
  primary_keys: z
    .array(changeFieldValueApiSchema)
    .min(1)
    .transform(fieldsTransform),
  schema_name: z.string(),
  table_name: z.string(),
});

export const addChangeSchema = z.object({
  action: z.literal("ADD"),
  fields: z.array(changeFieldValueApiSchema).min(1).transform(fieldsTransform),
  schema_name: z.string(),
  table_name: z.string(),
});

export const changeSchema = z.discriminatedUnion("action", [
  addChangeSchema,
  modifyChangeSchema,
  deleteChangeSchema,
]);

export type ChangeInput = z.input<typeof changeSchema>;

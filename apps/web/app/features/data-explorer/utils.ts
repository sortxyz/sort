import type { V2 } from "@sort/sdk";
import { z } from "zod";
import { changeSchema } from "~/schemas/change";
import {
  buildCreateQueryIntentSchema,
  buildRunQueryIntentSchema,
  buildUpdateQueryIntentSchema,
} from "~/schemas/query";

function columnValueToString(value: unknown) {
  switch (typeof value) {
    case "object":
      if (value === null) {
        return "NULL";
      }
      return JSON.stringify(value);
    case "boolean":
      return String(value).toUpperCase();
    default:
      return String(value);
  }
}

export function recordToColumnStringArray(record: unknown[]) {
  return record.map(columnValueToString);
}

export const INTENTS = {
  createChangeRequest: "createChangeRequest",
  updateChangeRequest: "updateChangeRequest",
  createQuery: "createQuery",
  updateQuery: "updateQuery",
  runQuery: "runQuery",
} as const;

export const schema = z.discriminatedUnion("intent", [
  buildRunQueryIntentSchema(),
  buildCreateQueryIntentSchema(),
  buildUpdateQueryIntentSchema(),
  z.object({
    intent: z.literal(INTENTS.createChangeRequest),
    title: z.string().min(2),
    description: z.string().min(1).nullable().default(null),
    changes: z.array(changeSchema).min(1),
  }),
  z.object({
    intent: z.literal(INTENTS.updateChangeRequest),
    changes: z.array(changeSchema).min(1),
  }),
]);

export const getFullColumn =
  (partialColumn: Pick<V2.Column, "type" | "name">) =>
  (fullColumn: V2.Column) =>
    partialColumn.name === fullColumn.name &&
    partialColumn.type === fullColumn.type;

export const buildFullColumn = (
  partialColumn: Pick<V2.Column, "type" | "name">,
): V2.Column => ({
  ...partialColumn,
  has_default: false,
  is_primary_key: false,
  nullable: true,
});

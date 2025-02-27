import type { V2 } from "@sort/sdk";
import type { getFlags } from "~/services/flags.server";

export function buildPermissions({
  dataProvider,
  queryType,
  allColumns,
  resultColumns,
  flags,
}: {
  dataProvider: V2.Connection["data_provider"];
  queryType: string;
  allColumns: V2.Column[];
  resultColumns: V2.Column[];
  flags: Awaited<ReturnType<typeof getFlags>>;
}): Record<
  | "canAddRows"
  | "canEditRows"
  | "canRemoveRows"
  | "canLinkRows"
  | "canDescribeChanges",
  V2.Permission
> {
  const primaryKeysTotal = allColumns.filter((c) => c.is_primary_key).length;
  const resultPrimaryKeysTotal = resultColumns.filter(
    (c) => c.is_primary_key,
  ).length;
  const resultHasAllPrimaryKeys = primaryKeysTotal === resultPrimaryKeysTotal;
  const isPostgres = dataProvider === "postgres";

  return {
    canAddRows: {
      value:
        isPostgres &&
        queryType === "intent" &&
        flags.changeRequests &&
        primaryKeysTotal !== 0,
    },
    canEditRows: {
      value:
        isPostgres &&
        queryType === "intent" &&
        flags.changeRequests &&
        primaryKeysTotal > 0 &&
        resultHasAllPrimaryKeys,
    },
    canRemoveRows: {
      value:
        isPostgres &&
        queryType === "intent" &&
        flags.changeRequests &&
        primaryKeysTotal > 0 &&
        resultHasAllPrimaryKeys,
    },
    canLinkRows: {
      value:
        isPostgres &&
        queryType === "intent" &&
        primaryKeysTotal > 0 &&
        resultHasAllPrimaryKeys,
    },
    canDescribeChanges: {
      value:
        flags.describeChanges &&
        isPostgres &&
        queryType === "intent" &&
        primaryKeysTotal > 0 &&
        resultHasAllPrimaryKeys,
    },
  };
}

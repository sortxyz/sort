import type { V2 } from "@sort/sdk";

export function getDefaultPort(dataProvider?: V2.Connection["data_provider"]) {
  switch (dataProvider) {
    case "postgres":
      return 5432;
    case "snowflake":
      return 443;
    default:
      return undefined;
  }
}
export function isDataProvider(
  dataProvider: unknown,
): dataProvider is V2.Connection["data_provider"] {
  return dataProvider === "postgres" || dataProvider === "snowflake";
}

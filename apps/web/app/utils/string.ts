export function capitalizeWord(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export function getNonBlankStringOrDefault<const U = undefined>(
  value: unknown,
  defaultValue?: U,
): string | U {
  return isNonBlankString(value) ? value : (defaultValue as U);
}

export function stringifyCSV(
  headers: string[],
  rows: unknown[][],
  options = { bom: false },
): string {
  const escapeCsvValue = (value: unknown): string => {
    if (value == null) {
      return "";
    }

    if (typeof value === "object") {
      return escapeCsvValue(JSON.stringify(value));
    }

    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    let stringValue = String(value);
    stringValue = stringValue.replace(/"/g, '""');
    if (stringValue.search(/("|,|\n)/g) >= 0) {
      stringValue = `"${stringValue}"`;
    }
    return stringValue;
  };

  const csvHeaders = headers.map(escapeCsvValue).join(",");
  const csvRows = rows
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
  const BOM = options.bom ? "\uFEFF" : "";

  return BOM + csvHeaders + "\n" + csvRows;
}

export function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

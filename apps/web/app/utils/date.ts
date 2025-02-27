// Array reprsenting one minute, hour, day, week, month, etc in seconds
const cutoffs = [60, 3_600, 86_400, 604_800, 2_592_000, 31_536_000, Infinity];

// Array equivalent to the above but in the string representation of the units
const units = [
  "second",
  "minute",
  "hour",
  "day",
  "week",
  "month",
  "year",
] satisfies Intl.RelativeTimeFormatUnit[];

export function getRelativeTimeString(
  date: Date | number,
  lang?: string,
): string {
  // Allow dates or times to be passed
  const timeMs = typeof date === "number" ? date : date.getTime();

  // Get the amount of seconds between the given date and now
  const deltaSeconds = Math.round((timeMs - Date.now()) / 1000);

  // Grab the ideal cutoff unit
  const unitIndex = cutoffs.findIndex(
    (cutoff) => cutoff > Math.abs(deltaSeconds),
  );

  // Get the divisor to divide from the seconds. E.g. if our unit is "day" our divisor
  // is one day in seconds, so we can divide our seconds by this to get the # of days
  const divisor = cutoffs[unitIndex - 1] ?? 1;
  const unit = units[unitIndex] ?? "minute";

  // Intl.RelativeTimeFormat do its magic
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  return rtf.format(Math.floor(deltaSeconds / divisor), unit);
}

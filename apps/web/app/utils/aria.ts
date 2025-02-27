export function orderDirectionToAriaSort(
  direction: "ASC" | "DESC" | undefined,
) {
  switch (direction) {
    case "ASC":
      return "ascending";
    case "DESC":
      return "descending";
    default:
      return "none";
  }
}

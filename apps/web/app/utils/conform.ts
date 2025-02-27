/**
 * Conform stores array values as a string if there are only 1 elements.
 * And if there are more than 1 element, it stores the values as an array.
 *
 * @param value - The value to count.
 * @returns The number of values in the array.
 */
export function countConformArrayValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length;
  } else if (typeof value === "string") {
    return 1;
  }

  return 0;
}
